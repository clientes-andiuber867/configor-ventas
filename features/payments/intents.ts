import { nextSaleReference } from "@/lib/domain";
import "server-only";
import { createHash } from "node:crypto";
import { HttpError } from "@/features/auth/server";
import { readStore, updateStore } from "@/lib/local-store";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { checkQR, generateQR, cancelQR } from "./bank";

export type PaymentIntent = {
  id: string;
  reference: string;
  saleReference?: string;
  cashier: string;
  fingerprint: string;
  amount: number;
  qrId?: string;
  qrImage?: string;
  dueDate?: string;
  state: "new" | "generating" | "ready" | "error";
  paid?: boolean;
  cancelled?: boolean;
};
export async function getIntent(id: string) {
  if (!cloudEnabled())
    return (await readStore()).paymentIntents?.find((p) => p.id === id);
  return (
    await rest<PaymentIntent[]>(
      "configor_payment_intents",
      "id=eq." + encodeURIComponent(id),
    )
  )[0];
}
export async function reserveIntent(
  d: {
    id: string;
    items: unknown[];
    cash: number;
    qr: number;
    wholesale_customer_id?: string;
  },
  cashier: string,
) {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        items: d.items,
        cash: d.cash,
        qr: d.qr,
        ...(d.wholesale_customer_id
          ? { wholesale_customer_id: d.wholesale_customer_id }
          : {}),
      }),
    )
    .digest("hex");
  let intent: PaymentIntent;
  if (!cloudEnabled()) {
    intent = await updateStore((s) => {
      s.paymentIntents ||= [];
      const old = s.paymentIntents.find((p) => p.id === d.id);
      if (old && s.sales.some((x) => x.id === d.id)) return old;
      if (!s.cashSessions?.some((x) => x.cashier === cashier && !x.closed))
        throw new HttpError(409, "Abre tu caja antes de realizar una venta.");
      if (old) return old;
      const p: PaymentIntent = {
        id: d.id,
        reference: "Q" + d.id.replaceAll("-", ""),
        saleReference: nextSaleReference(s.sales),
        cashier,
        fingerprint,
        amount: d.qr,
        state: "new",
      };
      s.paymentIntents.push(p);
      return p;
    });
  } else {
    const result = await rest<PaymentIntent & { error?: string }>(
      "rpc/configor_reserve_cash_payment",
      "",
      {
        method: "POST",
        body: JSON.stringify({
          p_id: d.id,
          p_cashier: cashier,
          p_fingerprint: fingerprint,
          p_amount: d.qr,
        }),
      },
    );
    if (result.error) throw new HttpError(409, result.error);
    intent = result;
  }
  if (intent.cashier !== cashier || intent.fingerprint !== fingerprint)
    throw new HttpError(
      409,
      "Esta referencia ya está vinculada a otra venta o importe. Retoma el cobro original.",
    );
  if (intent.cancelled)
    throw new HttpError(409, "Este cobro fue cancelado. Inicia uno nuevo.");
  return intent;
}
async function patch(
  id: string,
  values: Partial<PaymentIntent>,
  expectedState?: string,
) {
  if (!cloudEnabled())
    return updateStore((s) => {
      const p = s.paymentIntents?.find((p) => p.id === id);
      if (!p || (expectedState && p.state !== expectedState)) return false;
      Object.assign(p, values);
      return true;
    });
  const rows = await rest<PaymentIntent[]>(
    "configor_payment_intents",
    "id=eq." +
      encodeURIComponent(id) +
      (expectedState ? "&state=eq." + expectedState : ""),
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(values),
    },
  );
  return rows.length > 0;
}
export async function generateIntent(intent: PaymentIntent) {
  if (intent.cancelled) throw new HttpError(409, "El cobro fue cancelado.");
  if (intent.qrId) return intent;
  if (intent.state === "error")
    throw new HttpError(
      409,
      "No se pudo recuperar la respuesta del banco para " +
        intent.reference +
        ". Verifica esta referencia con el banco antes de iniciar otro cobro.",
    );
  if (!(await patch(intent.id, { state: "generating" }, "new")))
    return (await getIntent(intent.id))!;
  try {
    const qr = await generateQR(
      intent.amount,
      intent.saleReference || intent.reference,
      intent.reference,
    );
    await patch(intent.id, { ...qr, state: "ready" });
    return { ...intent, ...qr, state: "ready" as const };
  } catch {
    await patch(intent.id, { state: "error" });
    throw new HttpError(
      502,
      "No se obtuvo el QR de " +
        intent.reference +
        ". Verifica la conexión y esta referencia con el banco antes de iniciar otro cobro.",
    );
  }
}
export async function verifyIntent(intent: PaymentIntent, requirePaid = false) {
  if (intent.cancelled) {
    if (requirePaid) throw new HttpError(409, "Este cobro fue cancelado.");
    return { paid: false, cancelled: true };
  }
  if (!intent.qrId)
    throw new HttpError(400, "Primero genera el QR de esta venta.");
  if (intent.paid) return { paid: true, cancelled: false };
  const status = await checkQR(intent.qrId);
  if (
    status.paid &&
    status.payment?.amount != null &&
    Math.round(Number(status.payment.amount) * 100) !== intent.amount
  )
    throw new HttpError(409, "El importe recibido no coincide con el cobro.");
  if (status.paid) await patch(intent.id, { paid: true });
  if (requirePaid && !status.paid)
    throw new HttpError(
      400,
      "El banco todavía no confirmó el pago de esta venta.",
    );
  return { paid: status.paid, cancelled: status.cancelled };
}

export async function cancelIntent(intent: PaymentIntent) {
  if (intent.cancelled) return { paid: false, cancelled: true };
  if (intent.paid) return { paid: true, cancelled: false };
  if (!intent.qrId) {
    // Claim an unstarted intent atomically, so generation cannot begin afterwards.
    if (
      intent.state === "new" &&
      (await patch(intent.id, { state: "error", cancelled: true }, "new"))
    )
      return { paid: false, cancelled: true };
    throw new HttpError(
      409,
      "El banco aún no devolvió el QR. Espera a que termine la solicitud y vuelve a cancelar.",
    );
  }
  let status = await verifyIntent(intent);
  if (status.paid) return status;
  if (!status.cancelled) {
    try {
      await cancelQR(intent.qrId);
    } catch (error) {
      // Cancellation can race a payment, or its response can be lost.
      status = await verifyIntent(intent);
      if (status.paid) return status;
      if (!status.cancelled) throw error;
    }
    status = await verifyIntent(intent);
    if (status.paid) return status;
    if (!status.cancelled)
      throw new HttpError(
        409,
        "El banco todavía no confirmó la anulación. Intenta nuevamente.",
      );
  }
  await patch(intent.id, { cancelled: true });
  return { paid: false, cancelled: true };
}

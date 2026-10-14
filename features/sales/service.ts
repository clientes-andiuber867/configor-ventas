import {
  getIntent,
  reserveIntent,
  verifyIntent,
} from "@/features/payments/intents";
import { HttpError } from "@/features/auth/server";
import { decodeBarcode, type Line, type Member } from "@/lib/domain";
import { saleContext } from "./context";
import { insertSale, voidSale } from "@/features/sales/repository";
import { z } from "zod";
import { findCustomer } from "@/features/wholesale/repository";
export const saleSchema = z.object({
  wholesale_customer_id: z.string().uuid().optional(),
  id: z.string().uuid(),
  items: z
    .array(
      z.object({
        code: z.string(),
        barcode: z.string().max(32),
        grams: z.number().int().positive().max(1000000).nullable(),
        amount: z.number().int().positive().max(100000000),
        source: z.enum(["label", "manual", "unit"]),
      }),
    )
    .min(1)
    .max(100),
  cash: z.number().int().nonnegative(),
  qr: z.number().int().nonnegative(),
  qrConfirmed: z.boolean().optional(),
});
export async function prepareSale(input: unknown) {
  const d = saleSchema.parse(input);
  if (d.wholesale_customer_id) {
    if (d.items.some((line) => line.source === "manual"))
      throw new HttpError(
        400,
        "Escanea una etiqueta con el importe de la balanza para la venta mayorista.",
      );
    if (!(await findCustomer(d.wholesale_customer_id)))
      throw new HttpError(404, "Cliente mayorista no encontrado.");
  }
  const { products, settings } = await saleContext(d.items);
  const items: Line[] = d.items.map((line, i) => {
    const p = products.find((p) => p.code === line.code);
    if (!p) throw new HttpError(400, "Un producto ya no existe.");
    if (p.mode === "unit" || line.source === "unit") {
      if (
        p.mode !== "unit" ||
        line.source !== "unit" ||
        line.barcode !== p.code ||
        line.grams !== null ||
        line.amount !== p.price
      )
        throw new HttpError(
          400,
          "El precio o código del producto por unidad cambió. Vuelve a escanearlo.",
        );
    }
    if (line.source === "label") {
      const decoded = decodeBarcode(line.barcode, products, settings.rule);
      if (
        decoded.product.code !== p.code ||
        decoded.amount === null ||
        decoded.amount !== line.amount ||
        decoded.grams !== line.grams
      )
        throw new HttpError(
          400,
          "La etiqueta no coincide con el importe o peso. Vuelve a escanearla.",
        );
    }
    return { ...line, id: String(i), name: p.name };
  });
  const total = items.reduce((n, l) => n + l.amount, 0);
  if (total !== d.cash + d.qr)
    throw new HttpError(400, "Los pagos deben sumar exactamente el total.");
  return { d, items, total, settings };
}
export async function registerSale(input: unknown, user: Member) {
  const { d, items, total, settings } = await prepareSale(input);
  // Invalid direct QR submissions must not leave an unstarted reservation
  // that would prevent closing the register.
  if (d.qr > 0 && !(await getIntent(d.id)))
    throw new HttpError(400, "Primero genera el QR de esta venta.");
  const intent = await reserveIntent(d, user.email);
  if (d.qr > 0) await verifyIntent(intent, true);
  const sale = await insertSale({
    wholesale_customer_id: d.wholesale_customer_id,
    id: d.id,
    qr_id: intent.qrId || undefined,
    created: new Date().toISOString(),
    cashier: user.email,
    total,
    cash: d.cash,
    qr: d.qr,
    items,
    status: "completed",
    qr_recipient: d.qr ? settings.payments.recipient : undefined,
  });
  if (
    sale.cashier !== user.email ||
    sale.total !== total ||
    sale.cash !== d.cash ||
    sale.qr !== d.qr ||
    (sale.wholesale_customer_id || undefined) !== d.wholesale_customer_id ||
    sale.items.length !== items.length ||
    sale.items.some((item, i) =>
      ["code", "barcode", "grams", "amount", "source"].some(
        (key) => item[key as keyof Line] !== items[i][key as keyof Line],
      ),
    )
  )
    throw new HttpError(409, "El identificador pertenece a otra venta.");
  return { id: sale.id, sale };
}
export async function cancelSale(id: unknown, reason: unknown) {
  const sale = await voidSale(
    z.string().uuid().parse(id),
    z.string().trim().min(5).max(250).parse(reason),
  );
  if (!sale) throw new HttpError(404, "Venta no encontrada.");
  return { ok: true, sale };
}

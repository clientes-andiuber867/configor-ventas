import "server-only";
import { randomUUID } from "node:crypto";
import { readStore, updateStore, type Store } from "@/lib/local-store";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { HttpError } from "@/lib/http/errors";
import { today, type Member } from "@/lib/domain";
import type { CashSession, CashState } from "./types";

function totals(s: Store, session: CashSession): CashSession {
  if (session.closed) return session;
  let cash_sales = 0,
    qr_sales = 0,
    sale_count = 0;
  for (const sale of s.sales) {
    if (sale.cash_session_id !== session.id || sale.status !== "completed")
      continue;
    cash_sales += sale.cash;
    qr_sales += sale.qr;
    sale_count++;
  }
  return {
    ...session,
    cash_sales,
    qr_sales,
    sale_count,
    expected: session.opening + cash_sales,
  };
}

export async function cashRegister(
  user: Member,
  input: {
    action: "read" | "open" | "close";
    id?: string;
    amount?: number;
    note?: string;
    history?: boolean;
  },
): Promise<CashState> {
  if (cloudEnabled()) {
    const result = await rest<CashState & { error?: string }>(
      "rpc/configor_cash_register",
      "",
      {
        method: "POST",
        body: JSON.stringify({
          p_cashier: user.email,
          p_admin: user.role === "admin",
          p_action: input.action,
          p_id: input.id || null,
          p_amount: input.amount ?? null,
          p_note: input.note || "",
          p_history: !!input.history,
        }),
      },
    );
    if (result.error) throw new HttpError(409, result.error);
    return result;
  }
  const process = (s: Store): CashState => {
    s.cashSessions ||= [];
    let active = s.cashSessions.find(
      (x) => x.cashier === user.email && !x.closed,
    );
    if (input.action === "open") {
      const previous = s.cashSessions.find((x) => x.id === input.id);
      if (previous && previous.cashier !== user.email)
        throw new HttpError(409, "Identificador de caja no disponible.");
      if (!previous) {
        if (active) throw new HttpError(409, "Ya tienes una caja abierta.");
        active = {
          id: input.id || randomUUID(),
          cashier: user.email,
          opened: new Date().toISOString(),
          closed: null,
          opening: input.amount!,
          counted: null,
          expected: null,
          difference: null,
          cash_sales: 0,
          qr_sales: 0,
          sale_count: 0,
          opening_note: input.note || "",
          closing_note: "",
        };
        s.cashSessions.push(active);
      }
    }
    if (input.action === "close") {
      const session = s.cashSessions.find(
        (x) => x.id === input.id && x.cashier === user.email,
      );
      if (!session) throw new HttpError(404, "Caja no encontrada.");
      if (!session.closed) {
        const pending = s.paymentIntents?.some(
          (p) =>
            p.cashier === user.email &&
            p.amount > 0 &&
            !p.cancelled &&
            !s.sales.some((sale) => sale.id === p.id),
        );
        if (pending)
          throw new HttpError(
            409,
            "Finaliza o cancela los cobros QR pendientes antes de cerrar caja.",
          );
        const summary = totals(s, session);
        const difference = input.amount! - summary.expected!;
        if (difference !== 0 && !input.note?.trim())
          throw new HttpError(
            409,
            "Añade una observación para explicar el faltante o sobrante.",
          );
        Object.assign(session, summary, {
          closed: new Date().toISOString(),
          counted: input.amount,
          difference,
          closing_note: input.note || "",
        });
      }
      active = s.cashSessions.find(
        (x) => x.cashier === user.email && !x.closed,
      );
    }
    const start = today() + "T00:00:00-04:00";
    return {
      active: active ? totals(s, active) : null,
      history: input.history
        ? s.cashSessions
            .filter(
              (x) =>
                x.closed &&
                (user.role === "admin" ||
                  (x.cashier === user.email &&
                    x.closed >= new Date(start).toISOString())),
            )
            .sort((a, b) => b.closed!.localeCompare(a.closed!))
            .slice(0, 50)
        : [],
    };
  };
  return input.action === "read"
    ? process(await readStore())
    : updateStore(process);
}

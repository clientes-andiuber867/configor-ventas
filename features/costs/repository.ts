import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { write, eq } from "@/lib/supabase/queries";
import { readStore, updateStore } from "@/lib/local-store";
import { HttpError } from "@/lib/http/errors";
import { emptyCostSheet, type CostSheet } from "./model";
const conflict = () =>
  new HttpError(
    409,
    "Otro administrador actualizó estos costos. Recarga los datos antes de guardar.",
  );
export async function readCosts(): Promise<CostSheet> {
  if (!cloudEnabled()) return (await readStore()).orderCosts || emptyCostSheet;
  return (
    (
      await rest<{ value: CostSheet }[]>(
        "configor_settings",
        "id=eq.order_costs&select=value&limit=1",
      )
    )[0]?.value || emptyCostSheet
  );
}
export async function saveCosts(input: CostSheet): Promise<CostSheet> {
  const next = { ...input, version: crypto.randomUUID() };
  if (!cloudEnabled())
    return updateStore((store) => {
      if ((store.orderCosts?.version || "") !== input.version) throw conflict();
      store.orderCosts = next;
      return next;
    });
  const rows = input.version
    ? await rest<unknown[]>(
        "configor_settings",
        "id=eq.order_costs&value->>version=" + eq(input.version),
        write({ value: next }, "PATCH", "return=representation"),
      )
    : await rest<unknown[]>(
        "configor_settings",
        "",
        write(
          { id: "order_costs", value: next },
          "POST",
          "resolution=ignore-duplicates,return=representation",
        ),
      );
  if (!rows.length) throw conflict();
  return next;
}

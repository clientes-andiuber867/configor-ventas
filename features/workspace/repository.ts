import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { readStore, updateStore } from "@/lib/local-store";
import { write } from "@/lib/supabase/queries";
import type { BarcodeRule } from "@/lib/domain";
export type Settings = {
  owner: string;
  rule: BarcodeRule;
  payments: { recipient: string; qrKey: string };
};
export async function getSettings(): Promise<Settings> {
  if (!cloudEnabled()) {
    const { owner, rule, payments } = await readStore();
    return { owner, rule, payments };
  }
  const rows =
    await rest<{ id: keyof Settings; value: any }[]>("configor_settings");
  const result = Object.fromEntries(
    rows.map((r) => [r.id, r.value]),
  ) as Settings;
  if (!result.rule || !result.payments || !result.owner)
    throw Error("La migraciÃ³n de la configuraciÃ³n estÃ¡ incompleta.");
  return result;
}

export async function saveSetting<K extends keyof Settings>(
  id: K,
  value: Settings[K],
) {
  if (!cloudEnabled())
    return updateStore((s) => {
      Object.assign(s, { [id]: value });
    });
  await rest("configor_settings", "", write({ id, value }));
}

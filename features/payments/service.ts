import { updateStore } from "@/lib/local-store";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { z } from "zod";
export async function patchPayments(patch: {
  recipient?: string;
  qrKey?: string;
}) {
  if (!cloudEnabled())
    return updateStore((s) => {
      Object.assign(s.payments, patch);
    });
  await rest("rpc/configor_patch_payments", "", {
    method: "POST",
    body: JSON.stringify({ p_patch: patch }),
  });
}
export async function updateRecipient(input: unknown) {
  await patchPayments({
    recipient: z.string().trim().min(1).max(150).parse(input),
  });
  return { ok: true };
}

import "server-only";
import type { Product } from "@/lib/domain";
import type { Settings } from "@/features/workspace/repository";
import { readStore } from "@/lib/local-store";
import { cloudEnabled, rest } from "@/lib/supabase/client";

// Include exact-barcode candidates to preserve decoder precedence even when
// a label happens to be another product's direct code.
export async function saleContext(
  items: { code: string; barcode: string }[],
): Promise<{ products: Product[]; settings: Settings }> {
  const codes = [
    ...new Set(
      items.flatMap((item) => [
        item.code,
        item.barcode.trim(),
        item.barcode.trim().slice(0, -1),
      ]),
    ),
  ];
  if (!cloudEnabled()) {
    const store = await readStore();
    const wanted = new Set(codes);
    return {
      products: store.products.filter((p) => wanted.has(p.code)),
      settings: {
        owner: store.owner,
        rule: store.rule,
        payments: store.payments,
      },
    };
  }
  return rest("rpc/configor_sale_context", "", {
    method: "POST",
    body: JSON.stringify({ p_codes: codes }),
  });
}

import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { readStore, updateStore } from "@/lib/local-store";
import { write } from "@/lib/supabase/queries";
import type { Product } from "@/lib/domain";
export async function listProducts(): Promise<Product[]> {
  if (!cloudEnabled()) return (await readStore()).products;
  const products: Product[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest<Product[]>(
      "configor_products",
      "order=code&limit=1000&offset=" + offset,
    );
    products.push(...rows);
    if (rows.length < 1000) return products;
  }
}

export async function importProducts(products: Product[]) {
  if (!cloudEnabled())
    return updateStore((s) => {
      for (const p of products) {
        const i = s.products.findIndex((x) => x.code === p.code);
        if (i < 0) s.products.push(p);
        else s.products[i] = p;
      }
    });
  await rest("configor_products", "", write(products));
}

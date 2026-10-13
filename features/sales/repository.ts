import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { readStore, updateStore } from "@/lib/local-store";
import { eq, write } from "@/lib/supabase/queries";
import { nextSaleReference, type Sale } from "@/lib/domain";
export async function listSales(from: string, to: string): Promise<Sale[]> {
  const start = from + "T00:00:00-04:00",
    end = to + "T23:59:59.999-04:00";
  if (!cloudEnabled())
    return (await readStore()).sales
      .filter(
        (s) =>
          Date.parse(s.created) >= Date.parse(start) &&
          Date.parse(s.created) <= Date.parse(end),
      )
      .sort((a, b) => b.created.localeCompare(a.created));
  const result: Sale[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await rest<Sale[]>(
      "configor_sales",
      "created=gte." +
        encodeURIComponent(start) +
        "&created=lte." +
        encodeURIComponent(end) +
        "&order=created.desc,id&limit=1000&offset=" +
        offset,
    );
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
}

export async function findSale(id: string): Promise<Sale | undefined> {
  if (!cloudEnabled())
    return (await readStore()).sales.find((s) => s.id === id);
  return (await rest<Sale[]>("configor_sales", "id=" + eq(id) + "&limit=1"))[0];
}

export async function insertSale(sale: Sale): Promise<Sale> {
  if (!cloudEnabled())
    return updateStore((s) => {
      const old = s.sales.find((x) => x.id === sale.id);
      if (old) return old;
      sale = { ...sale, reference: nextSaleReference(s.sales) };
      s.sales.push(sale);
      return sale;
    });
  return rest<Sale>(
    "rpc/configor_insert_numbered_sale",
    "",
    write({ p_sale: sale }),
  );
}

export async function voidSale(id: string, reason: string) {
  if (!cloudEnabled())
    return updateStore((s) => {
      const sale = s.sales.find((x) => x.id === id);
      if (sale) {
        sale.status = "void";
        sale.void_reason = reason;
      }
      return sale;
    });
  return (
    await rest<Sale[]>(
      "configor_sales",
      "id=" + eq(id),
      write(
        { status: "void", void_reason: reason },
        "PATCH",
        "return=representation",
      ),
    )
  )[0];
}

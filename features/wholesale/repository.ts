import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { eq, write } from "@/lib/supabase/queries";
import { readStore, updateStore } from "@/lib/local-store";
import { dayOf, today, type Sale } from "@/lib/domain";
import { HttpError } from "@/lib/http/errors";
import {
  CUSTOMER_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  type WholesaleCustomer,
} from "./types";

export async function findCustomer(id: string) {
  if (!cloudEnabled())
    return (await readStore()).wholesaleCustomers?.find((c) => c.id === id);
  return (
    await rest<WholesaleCustomer[]>(
      "configor_wholesale_customers",
      "id=" + eq(id) + "&limit=1",
    )
  )[0];
}

export async function createCustomer(customer: WholesaleCustomer) {
  if (!cloudEnabled())
    return updateStore((s) => {
      s.wholesaleCustomers ||= [];
      const old = s.wholesaleCustomers.find((c) => c.id === customer.id);
      if (old) {
        if (old.name !== customer.name || old.phone !== customer.phone)
          throw new HttpError(
            409,
            "Este identificador pertenece a otro cliente.",
          );
        return old;
      }
      s.wholesaleCustomers.push(customer);
      return customer;
    });
  await rest(
    "configor_wholesale_customers",
    "",
    write(customer, "POST", "resolution=ignore-duplicates"),
  );
  const saved = await findCustomer(customer.id);
  if (!saved || saved.name !== customer.name || saved.phone !== customer.phone)
    throw new HttpError(409, "Este identificador pertenece a otro cliente.");
  return saved;
}

export async function listCustomers(search: string, offset: number) {
  let rows: WholesaleCustomer[];
  if (!cloudEnabled()) {
    rows = ((await readStore()).wholesaleCustomers || [])
      .filter((c) =>
        c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      )
      .sort(
        (a, b) =>
          b.created.localeCompare(a.created) || b.id.localeCompare(a.id),
      )
      .slice(offset, offset + CUSTOMER_PAGE_SIZE + 1);
  } else {
    // Quote the PostgREST value and escape LIKE wildcards; user text stays literal.
    const pattern = "%" + search.replace(/[\\%_*]/g, "\\$&") + "%";
    const filter = search
      ? "&name=ilike." + encodeURIComponent(JSON.stringify(pattern))
      : "";
    rows = await rest<WholesaleCustomer[]>(
      "configor_wholesale_customers",
      "select=id,name,phone,created&order=created.desc,id.desc&limit=" +
        (CUSTOMER_PAGE_SIZE + 1) +
        "&offset=" +
        offset +
        filter,
    );
  }
  return {
    customers: rows.slice(0, CUSTOMER_PAGE_SIZE),
    hasMore: rows.length > CUSTOMER_PAGE_SIZE,
  };
}

export type HistoryCursor = { created: string; id: string };
export async function customerHistory(
  id: string,
  cursor: HistoryCursor | null,
  admin: boolean,
) {
  let rows: Sale[];
  if (!cloudEnabled()) {
    rows = (await readStore()).sales
      .filter(
        (s) =>
          s.wholesale_customer_id === id &&
          (admin || dayOf(s.created) === today()),
      )
      .filter(
        (s) =>
          !cursor ||
          s.created < cursor.created ||
          (s.created === cursor.created && s.id < cursor.id),
      )
      .sort(
        (a, b) =>
          b.created.localeCompare(a.created) || b.id.localeCompare(a.id),
      )
      .slice(0, HISTORY_PAGE_SIZE + 1);
  } else {
    const boundary = cursor
      ? "&or=" +
        encodeURIComponent(
          `(created.lt.${cursor.created},and(created.eq.${cursor.created},id.lt.${cursor.id}))`,
        )
      : "";
    const day = today();
    const daily = admin
      ? ""
      : "&created=gte." +
        encodeURIComponent(day + "T00:00:00-04:00") +
        "&created=lte." +
        encodeURIComponent(day + "T23:59:59.999-04:00");
    rows = await rest<Sale[]>(
      "configor_sales",
      "wholesale_customer_id=" +
        eq(id) +
        "&order=created.desc,id.desc&limit=" +
        (HISTORY_PAGE_SIZE + 1) +
        boundary +
        daily,
    );
  }
  const sales = rows.slice(0, HISTORY_PAGE_SIZE);
  const last = sales.at(-1);
  return {
    sales,
    next:
      rows.length > HISTORY_PAGE_SIZE && last
        ? { created: last.created, id: last.id }
        : null,
  };
}

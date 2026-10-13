import { nextSaleReference } from "../domain";
import "server-only";
import { cloudEnabled, rest } from "./client";
import { readStore, updateStore, type LocalMember } from "../local-store";
import type { Product, Sale, BarcodeRule } from "../domain";
type Session = { tokenHash: string; email: string; expires: number };
export type Settings = {
  owner: string;
  rule: BarcodeRule;
  payments: { recipient: string; qrKey: string };
};
const eq = (value: string) => "eq." + encodeURIComponent(value);
const write = (
  body: unknown,
  method = "POST",
  prefer = "resolution=merge-duplicates,return=minimal",
) => ({ method, body: JSON.stringify(body), headers: { Prefer: prefer } });

export async function getMember(
  username: string,
): Promise<LocalMember | undefined> {
  if (!cloudEnabled())
    return (await readStore()).members.find((m) => m.email === username);
  return (
    await rest<LocalMember[]>(
      "configor_members",
      "email=" + eq(username) + "&limit=1",
    )
  )[0];
}
export async function listMembers() {
  if (!cloudEnabled())
    return (await readStore()).members.map(({ passwordHash, ...m }) => m);
  return rest<Omit<LocalMember, "passwordHash">[]>(
    "configor_members",
    "select=email,name,role,active&order=name",
  );
}
export async function getSession(
  tokenHash: string,
): Promise<Session | undefined> {
  if (!cloudEnabled())
    return (await readStore()).sessions.find(
      (s) => s.tokenHash === tokenHash && s.expires > Date.now(),
    );
  return (
    await rest<Session[]>(
      "configor_sessions",
      "tokenHash=" + eq(tokenHash) + "&expires=gt." + Date.now() + "&limit=1",
    )
  )[0];
}
export async function saveSession(session: Session) {
  if (!cloudEnabled())
    return updateStore((s) => {
      s.sessions = s.sessions.filter((x) => x.expires > Date.now());
      s.sessions.push(session);
    });
  await rest("configor_sessions", "expires=lt." + Date.now(), {
    method: "DELETE",
  });
  await rest("configor_sessions", "", write(session));
}
export async function removeSession(tokenHash: string) {
  if (!cloudEnabled())
    return updateStore((s) => {
      s.sessions = s.sessions.filter((x) => x.tokenHash !== tokenHash);
    });
  await rest("configor_sessions", "tokenHash=" + eq(tokenHash), {
    method: "DELETE",
  });
}
export async function saveMember(member: LocalMember, revoke: boolean) {
  if (!cloudEnabled())
    return updateStore((s) => {
      const i = s.members.findIndex((m) => m.email === member.email);
      if (i < 0) s.members.push(member);
      else s.members[i] = member;
      if (revoke)
        s.sessions = s.sessions.filter((x) => x.email !== member.email);
    });
  await rest(
    "rpc/configor_save_member",
    "",
    write({ p_member: member, p_revoke: revoke }),
  );
}
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

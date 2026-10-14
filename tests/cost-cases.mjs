import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const code = ts.transpile(await readFile("features/costs/model.ts", "utf8"), {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
});
const { parseCost, orderCostTotal } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
export async function verifyCosts({ request, adminCookie, cashierCookie }) {
  assert.equal(parseCost("0,20"), 20);
  assert.equal(parseCost("0.10"), 10);
  for (const value of ["", "-1", "NaN", "1.001", "Infinity", "1e2"])
    assert.equal(parseCost(value), null);
  await request("/api/costs", null, "", 401);
  await request("/api/costs", null, cashierCookie, 403);
  const before = (await request("/api/data", null, adminCookie)).data;
  const initial = (await request("/api/costs", null, adminCookie)).data;
  assert.deepEqual(initial, { version: "", items: [] });
  const items = [
    { id: crypto.randomUUID(), name: "Bolsa", cents: 20, quantity: 1 },
    { id: crypto.randomUUID(), name: "Etiqueta", cents: 10, quantity: 1 },
  ];
  assert.equal(orderCostTotal(items), 30);
  assert.equal(orderCostTotal([{ ...items[0], quantity: 3 }, items[1]]), 70);
  await request("/api/costs", { ...initial, items }, cashierCookie, 403);
  for (const change of [
    { cents: -1 },
    { cents: 0.1 },
    { quantity: 0 },
    { quantity: 1.5 },
    { name: " " },
  ])
    await request(
      "/api/costs",
      { ...initial, items: [{ ...items[0], ...change }] },
      adminCookie,
      400,
    );
  await request(
    "/api/costs",
    { ...initial, items: [items[0], items[0]] },
    adminCookie,
    400,
  );
  const saved = (
    await request("/api/costs", { ...initial, items }, adminCookie)
  ).data;
  assert.deepEqual(
    (await request("/api/costs", null, adminCookie)).data,
    saved,
  );
  await request("/api/costs", { ...initial, items: [] }, adminCookie, 409);
  const updated = (
    await request("/api/costs", { ...saved, items: [items[0]] }, adminCookie)
  ).data;
  await request(
    "/api/costs",
    { ...saved, items: [items[0]] },
    adminCookie,
    409,
  );
  assert.equal(updated.items.length, 1);
  await request("/api/costs", { ...updated, items: [] }, adminCookie);
  assert.deepEqual(
    (await request("/api/costs", null, adminCookie)).data.items,
    [],
  );
  const after = (await request("/api/data", null, adminCookie)).data;
  for (const field of ["products", "sales", "rule", "payments"])
    assert.deepEqual(after[field], before[field], "Costs altered " + field);
  console.log(
    "PASS: costs arithmetic, admin-only access, validation, persistence, stale-write rejection and isolation from prices, sales and scale settings.",
  );
}

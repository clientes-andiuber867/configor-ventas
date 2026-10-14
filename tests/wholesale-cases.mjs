import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function verifyWholesale({
  request,
  adminCookie,
  cashierCookie,
  labelSale,
  directory,
  bankPayments,
}) {
  const customer = {
    id: crypto.randomUUID(),
    name: "María Mayorista",
    phone: "70000000",
  };
  await request("/api/wholesale", null, "", 401);
  await request("/api/wholesale", customer, cashierCookie, 403);
  await request("/api/wholesale", { ...customer, name: " " }, adminCookie, 400);
  const saved = (await request("/api/wholesale", customer, adminCookie)).data
    .customer;
  assert.equal(saved.name, customer.name);
  assert.deepEqual(
    (await request("/api/wholesale", customer, adminCookie)).data.customer,
    saved,
  );
  await request(
    "/api/wholesale",
    { ...customer, name: "Otro nombre" },
    adminCookie,
    409,
  );
  const second = { ...customer, id: crypto.randomUUID(), name: "Otro cliente" };
  await request("/api/wholesale", second, adminCookie);
  const list = (
    await request("/api/wholesale?q=Mar%C3%ADa", null, cashierCookie)
  ).data;
  assert.deepEqual(
    list.customers.map((c) => c.id),
    [customer.id],
  );
  await request("/api/wholesale?offset=-1", null, adminCookie, 400);
  await request(
    "/api/wholesale?customer=" + crypto.randomUUID(),
    null,
    adminCookie,
    404,
  );
  await request(
    "/api/wholesale?customer=" + customer.id + "&cursor=bad",
    null,
    adminCookie,
    400,
  );

  const sale = {
    ...labelSale,
    id: crypto.randomUUID(),
    wholesale_customer_id: customer.id,
  };
  await request("/api/data", sale, cashierCookie, 409);
  const shift = crypto.randomUUID();
  await request(
    "/api/cash-register",
    { action: "open", id: shift, amount: 0, note: "" },
    cashierCookie,
  );
  await request(
    "/api/data",
    { ...sale, wholesale_customer_id: crypto.randomUUID() },
    cashierCookie,
    404,
  );
  await request(
    "/api/data",
    { ...sale, items: [{ ...sale.items[0], source: "manual" }] },
    cashierCookie,
    400,
  );
  await request(
    "/api/data",
    { ...sale, items: [{ ...sale.items[0], amount: 1700 }], cash: 1700 },
    cashierCookie,
    400,
  );
  const result = (
    await request(
      "/api/data",
      { ...sale, wholesale_customer_name: "Forged name" },
      cashierCookie,
    )
  ).data.sale;
  assert.equal(result.wholesale_customer_name, customer.name);
  assert.equal(result.wholesale_customer_id, customer.id);
  assert.equal(result.cash_session_id, shift);
  const retries = await Promise.all([
    request("/api/data", sale, cashierCookie),
    request("/api/data", sale, cashierCookie),
  ]);
  assert(
    retries.every(
      (r) =>
        r.data.sale.id === result.id &&
        r.data.sale.reference === result.reference,
    ),
  );
  await request(
    "/api/data",
    { ...sale, wholesale_customer_id: second.id },
    cashierCookie,
    409,
  );
  await request(
    "/api/data",
    { ...sale, wholesale_customer_id: undefined },
    cashierCookie,
    409,
  );
  const retail = (
    await request(
      "/api/data",
      { ...labelSale, id: crypto.randomUUID() },
      cashierCookie,
    )
  ).data.sale;
  assert(!retail.wholesale_customer_id);
  assert(!retail.wholesale_customer_name);

  const mixed = { ...sale, id: crypto.randomUUID(), cash: 1000, qr: 630 };
  const intent = (await request("/api/payments", mixed, cashierCookie)).data;
  await request(
    "/api/payments",
    { ...mixed, wholesale_customer_id: second.id },
    cashierCookie,
    409,
  );
  await request("/api/data", mixed, cashierCookie, 400);
  bankPayments.get(intent.qrId).paid = true;
  const paid = (await request("/api/data", mixed, cashierCookie)).data.sale;
  assert.equal(paid.wholesale_customer_id, customer.id);
  await request(
    "/api/data",
    { action: "void", id: result.id, reason: "Prueba de anulación" },
    adminCookie,
  );
  const history = (
    await request("/api/wholesale?customer=" + customer.id, null, adminCookie)
  ).data;
  assert.equal(history.sales.length, 2);
  assert.equal(history.sales.find((s) => s.id === result.id).status, "void");
  assert.equal(
    (await request("/api/wholesale?customer=" + second.id, null, adminCookie))
      .data.sales.length,
    0,
  );
  await request(
    "/api/cash-register",
    { action: "close", id: shift, amount: retail.cash + paid.cash, note: "" },
    cashierCookie,
  );

  // Seed only the isolated fixture for deterministic pagination with timestamp ties.
  const file = path.join(directory, "configor.json");
  const fixture = JSON.parse(await readFile(file, "utf8"));
  for (let i = 0; i < 43; i++)
    fixture.sales.push({
      ...result,
      id: crypto.randomUUID(),
      created: "2001-01-01T12:00:00.000Z",
    });
  for (let i = 0; i < 25; i++)
    fixture.wholesaleCustomers.push({
      ...saved,
      id: crypto.randomUUID(),
      name: "Cliente " + i,
    });
  await writeFile(file, JSON.stringify(fixture));
  const seen = new Set();
  let cursor = null;
  do {
    const page = (
      await request(
        "/api/wholesale?customer=" +
          customer.id +
          (cursor
            ? "&cursor=" + encodeURIComponent(JSON.stringify(cursor))
            : ""),
        null,
        adminCookie,
      )
    ).data;
    assert(page.sales.length <= 20);
    for (const row of page.sales) {
      assert(!seen.has(row.id));
      seen.add(row.id);
    }
    cursor = page.next;
  } while (cursor);
  assert.equal(seen.size, 45);
  const daily = (
    await request("/api/wholesale?customer=" + customer.id, null, cashierCookie)
  ).data;
  assert.equal(daily.sales.length, 2);
  const first = (await request("/api/wholesale", null, adminCookie)).data;
  const next = (await request("/api/wholesale?offset=24", null, adminCookie))
    .data;
  assert.equal(first.customers.length, 24);
  assert(first.hasMore);
  assert.equal(next.customers.length, 3);
  assert(!next.hasMore);
  assert.equal(
    new Set([...first.customers, ...next.customers].map((c) => c.id)).size,
    27,
  );
  console.log(
    "PASS: wholesale admin creation, retry safety, label validation, customer binding, mixed QR, retail isolation, void history, register totals, cursor pagination and cashier history permissions.",
  );
}

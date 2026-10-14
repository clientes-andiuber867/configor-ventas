import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile("lib/domain.ts", "utf8");
const { decodeBarcode, defaultRule } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      ts.transpile(source, {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      }),
    ).toString("base64")
);

export async function verifyUnitProducts({
  request,
  adminCookie,
  cashierCookie,
  labelSale,
}) {
  const product = {
    code: "0001234567890",
    name: "Bebida de prueba",
    price: 750,
    mode: "unit",
    plu: "",
  };
  const save = (p) => ({ action: "unit-product", product: p });
  await request("/api/data", save(product), cashierCookie, 403);
  await request("/api/data", save({ ...product, price: 0 }), adminCookie, 400);
  await request("/api/data", save(product), adminCookie);
  const d = decodeBarcode(product.code, [product], defaultRule);
  assert.equal(d.amount, 750);
  assert.equal(d.grams, null);
  const weight = { ...product, code: "0470101", mode: "weight" };
  assert.equal(decodeBarcode(weight.code, [weight], defaultRule).amount, null);
  const scaleRule = { ...defaultRule, enabled: true, amountDecimals: 1 };
  assert.equal(
    decodeBarcode(labelSale.items[0].barcode, [weight], scaleRule).amount,
    labelSale.items[0].amount,
  );
  assert.throws(() =>
    decodeBarcode(
      labelSale.items[0].barcode,
      [{ ...weight, mode: "unit" }],
      scaleRule,
    ),
  );
  await request(
    "/api/data",
    save({ ...product, code: weight.code }),
    adminCookie,
    409,
  );
  await request(
    "/api/data",
    { action: "import", products: [{ ...product, mode: "weight" }] },
    adminCookie,
    409,
  );
  const shift = crypto.randomUUID();
  await request(
    "/api/cash-register",
    { action: "open", id: shift, amount: 0, note: "" },
    cashierCookie,
  );
  const line = {
    code: product.code,
    barcode: product.code,
    amount: product.price,
    grams: null,
    source: "unit",
  };
  const sale = {
    action: "sale",
    id: crypto.randomUUID(),
    items: [line, line, ...labelSale.items],
    cash: product.price * 2 + labelSale.cash,
    qr: 0,
  };
  for (const changed of [
    { ...line, amount: 1 },
    { ...line, grams: 100 },
    { ...line, source: "manual" },
    { ...line, source: "label" },
    { ...line, barcode: "12345678" },
  ]) {
    await request(
      "/api/data",
      { ...sale, items: [changed], cash: changed.amount },
      cashierCookie,
      400,
    );
  }
  const result = (await request("/api/data", sale, cashierCookie)).data.sale;
  assert.equal(result.items[0].source, "unit");
  assert.equal(result.items[0].grams, null);
  assert.equal(result.total, sale.cash);
  assert.equal(result.items.length, 3);
  assert.equal(
    (await request("/api/data", sale, cashierCookie)).data.sale.id,
    result.id,
  );
  await request("/api/data", save({ ...product, price: 800 }), adminCookie);
  await request(
    "/api/data",
    { ...sale, id: crypto.randomUUID() },
    cashierCookie,
    400,
  );
  const customer = (await request("/api/wholesale", null, adminCookie)).data
    .customers[0];
  const unitSale = {
    ...sale,
    id: crypto.randomUUID(),
    items: [{ ...line, amount: 800 }],
    cash: 800,
    wholesale_customer_id: customer.id,
  };
  const wholesale = (await request("/api/data", unitSale, cashierCookie)).data
    .sale;
  assert.equal(wholesale.wholesale_customer_id, customer.id);
  const catalog = (await request("/api/data", null, adminCookie)).data.products;
  assert.equal(catalog.find((p) => p.code === product.code).price, 800);
  assert.equal(catalog.find((p) => p.code === weight.code).mode, "weight");
  await request(
    "/api/cash-register",
    { action: "close", id: shift, amount: sale.cash + 800, note: "" },
    cashierCookie,
  );
  console.log(
    "PASS: unit products, admin permissions, fixed-price validation, scale compatibility, import collisions, mixed cart, repeated scans, wholesale and register totals.",
  );
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.CONFIGOR_TEST_URL || "http://127.0.0.1:3007";
const password = process.env.CONFIGOR_VERIFY_PASSWORD;
if (!password)
  throw Error("Set CONFIGOR_VERIFY_PASSWORD for this verification session");
let cookie = "";
async function req(endpoint, body, status = 200) {
  const started = performance.now();
  const response = await fetch(base + endpoint, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  if (response.headers.get("set-cookie"))
    cookie = response.headers.get("set-cookie").split(";")[0];
  return {
    data,
    ms: Math.round(performance.now() - started),
    bytes: Buffer.byteLength(JSON.stringify(data)),
  };
}
await req("/api/data", undefined, 401);
await req(
  "/api/auth",
  { action: "login", username: "admin", password: "incorrecta", role: "admin" },
  401,
);
await req(
  "/api/auth",
  { action: "login", username: "admin", password, role: "cashier" },
  403,
);
await req("/api/auth", {
  action: "login",
  username: "admin",
  password,
  role: "admin",
});
try {
  const local = JSON.parse(await readFile("data/configor.json", "utf8"));
  const result = await req("/api/data?from=2026-01-01&to=2026-12-31");
  assert.equal(result.data.products.length, local.products.length);
  assert.equal(result.data.members.length, local.members.length);
  assert.equal(result.data.sales.length, local.sales.length);
  assert.deepEqual(result.data.rule, local.rule);
  assert(result.data.members.every((m) => !m.passwordHash));
  const period = await req(
    "/api/data?scope=sales&from=2026-10-11&to=2026-10-11",
  );
  assert(!period.data.products);
  assert.equal(period.data.sales.length, 1);
  await req("/api/data?from=2026-12-31&to=2026-01-01", undefined, 400);
  const qr = await fetch(base + "/api/qr", { headers: { Cookie: cookie } });
  assert.equal(qr.status, 200);
  assert.deepEqual(
    Buffer.from(await qr.arrayBuffer()),
    await readFile("data/uploads/" + local.payments.qrKey),
  );
  if (process.env.CONFIGOR_VERIFY_CATALOG) {
    const form = new FormData();
    form.append(
      "file",
      new File(
        [await readFile(process.env.CONFIGOR_VERIFY_CATALOG)],
        "catalogoo.xls",
      ),
    );
    const preview = await fetch(base + "/api/catalog", {
      method: "POST",
      headers: { Cookie: cookie, Origin: base },
      body: form,
    });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).products.length, 41);
  }
  const stored = local.sales[0];
  if (stored.cashier === "admin") {
    const reply = await req("/api/data", {
      action: "sale",
      id: stored.id,
      items: stored.items,
      cash: stored.cash,
      qr: stored.qr,
      qrConfirmed: true,
    });
    assert.equal(reply.data.sale.id, stored.id);
    const after = await req(
      "/api/data?scope=sales&from=2026-01-01&to=2026-12-31",
    );
    assert.equal(after.data.sales.length, local.sales.length);
  }
  console.log(
    JSON.stringify({
      passed:
        "Supabase login, role checks, migration, QR integrity, date filtering, idempotent retry",
      fullData: result.ms + " ms / " + result.bytes + " bytes",
      periodOnly: period.ms + " ms / " + period.bytes + " bytes",
    }),
  );
} finally {
  await req("/api/auth", { action: "logout" });
  await req("/api/data", undefined, 401);
}

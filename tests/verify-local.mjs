import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
const port = 3006,
  base = "http://127.0.0.1:" + port;
const directory = path.resolve("tests/.local-data/" + crypto.randomUUID());
await mkdir(directory, { recursive: true });
const password = "Test-" + crypto.randomUUID(),
  salt = randomBytes(16).toString("hex");
await writeFile(
  path.join(directory, "configor.json"),
  JSON.stringify({
    version: 1,
    owner: "admin",
    members: [
      {
        email: "admin",
        name: "Admin Test",
        role: "admin",
        active: 1,
        passwordHash:
          salt + ":" + scryptSync(password, salt, 64).toString("hex"),
      },
    ],
    products: [],
    sales: [],
    rule: {
      enabled: false,
      pattern: "FWWWWWWEEEEENNNNNC",
      amountDecimals: 2,
      weightDecimals: 3,
      prefix: "",
      checksum: "none",
      codePad: 7,
    },
    payments: { recipient: "", qrKey: "" },
    sessions: [],
  }),
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      CONFIGOR_DATA_DIR: directory,
      CONFIGOR_STORAGE: "local",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));
let adminCookie = "",
  cashierCookie = "";
async function request(endpoint, body, cookie = "", expected = 200) {
  const r = await fetch(base + endpoint, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.equal(r.status, expected, JSON.stringify(d));
  return { data: d, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
try {
  let up = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/")).ok) {
        up = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(up, output);
  await request("/api/auth", null, "", 401);
  await request("/api/data", null, "", 401);
  await request(
    "/api/auth",
    {
      action: "login",
      username: "admin",
      password: "incorrecta",
      role: "admin",
    },
    "",
    401,
  );
  await request(
    "/api/auth",
    { action: "login", username: "admin", password, role: "cashier" },
    "",
    403,
  );
  adminCookie = (
    await request("/api/auth", {
      action: "login",
      username: "admin",
      password,
      role: "admin",
    })
  ).cookie;
  await request(
    "/api/auth",
    { action: "setup", name: "Other", email: "other@test.local", password },
    "",
    400,
  );
  await request(
    "/api/data",
    {
      action: "import",
      products: [
        {
          plu: "1",
          name: "BLANDA 1RO",
          code: "0470101",
          price: 7000,
          mode: "weight",
        },
      ],
    },
    adminCookie,
  );
  await request(
    "/api/data",
    {
      action: "member",
      member: {
        email: "cashier@test.local",
        name: "Caja Test",
        role: "cashier",
        active: 1,
        password,
      },
    },
    adminCookie,
  );
  cashierCookie = (
    await request("/api/auth", {
      action: "login",
      username: "cashier@test.local",
      password,
      role: "cashier",
    })
  ).cookie;
  await request(
    "/api/data",
    { action: "payments", recipient: "Denied" },
    cashierCookie,
    403,
  );
  const id = crypto.randomUUID(),
    sale = {
      action: "sale",
      id,
      items: [
        {
          code: "0470101",
          barcode: "04701019",
          grams: 260,
          amount: 1690,
          source: "manual",
        },
      ],
      cash: 1690,
      qr: 0,
      qrConfirmed: false,
    };
  await request(
    "/api/data",
    { ...sale, id: crypto.randomUUID(), cash: 1600 },
    cashierCookie,
    400,
  );
  await Promise.all([
    request("/api/data", sale, cashierCookie),
    request("/api/data", sale, cashierCookie),
  ]);
  let d = (await request("/api/data", null, adminCookie)).data;
  assert.equal(d.sales.length, 1);
  assert.equal(d.sales[0].total, 1690);
  assert.equal(d.members[0].passwordHash, undefined);
  await request(
    "/api/data",
    { action: "void", id, reason: "Prueba local" },
    cashierCookie,
    403,
  );
  await request(
    "/api/data",
    { action: "void", id, reason: "Prueba local" },
    adminCookie,
  );
  // Real label values and QR/mixed payment behavior, isolated from production.
  await request(
    "/api/data",
    {
      action: "rule",
      rule: {
        enabled: true,
        pattern: "FWWWWWWEEEEENNNNNC",
        amountDecimals: 1,
        weightDecimals: 3,
        prefix: "",
        checksum: "none",
        codePad: 7,
      },
    },
    adminCookie,
  );
  const labelSale = {
    action: "sale",
    id: crypto.randomUUID(),
    items: [
      {
        code: "0470101",
        barcode: "047010100163002407",
        grams: 240,
        amount: 1630,
        source: "label",
      },
    ],
    cash: 1630,
    qr: 0,
    qrConfirmed: false,
  };
  await request(
    "/api/data",
    {
      ...labelSale,
      items: [{ ...labelSale.items[0], amount: 1700 }],
      cash: 1700,
    },
    cashierCookie,
    400,
  );
  await request("/api/data", labelSale, cashierCookie);
  const form = new FormData();
  form.append(
    "file",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1sAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "qr.png",
      { type: "image/png" },
    ),
  );
  assert.equal(
    (
      await fetch(base + "/api/qr", {
        method: "POST",
        headers: { Origin: base, Cookie: adminCookie },
        body: form,
      })
    ).status,
    200,
  );
  await request(
    "/api/data",
    { action: "payments", recipient: "Beneficiario de prueba" },
    adminCookie,
  );
  const mixed = { ...labelSale, id: crypto.randomUUID(), cash: 1000, qr: 630 };
  await request("/api/data", mixed, cashierCookie, 400);
  await request("/api/data", { ...mixed, qrConfirmed: true }, cashierCookie);
  const period = (
    await request(
      "/api/data?scope=sales&from=2000-01-01&to=2000-01-02",
      null,
      adminCookie,
    )
  ).data;
  assert.deepEqual(period.sales, []);
  assert.equal(period.products, undefined);
  const csv = new FormData();
  csv.append(
    "file",
    new File(
      ["PLU NO;Name;Code;Price;Mode\n1;BLANDA 1RO;0470101;68;0"],
      "catalogo.csv",
    ),
  );
  const preview = await fetch(base + "/api/catalog", {
    method: "POST",
    headers: { Origin: base, Cookie: adminCookie },
    body: csv,
  });
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).products[0].code, "0470101");
  assert.equal(
    (
      await fetch(base + "/api/catalog", {
        method: "POST",
        headers: { Origin: base, Cookie: cashierCookie },
        body: csv,
      })
    ).status,
    403,
  );
  await request("/api/auth", { action: "logout" }, cashierCookie);
  await request("/api/data", null, cashierCookie, 401);
  const disk = JSON.parse(
    await readFile(path.join(directory, "configor.json"), "utf8"),
  );
  assert.equal(disk.sales[0].status, "void");
  assert(!disk.members.some((m) => m.passwordHash === password));
  console.log(
    "PASS: username login/logout, setup disabled, selected role validation, hashed passwords, cashier permissions, import, exact payment totals, concurrent idempotency, void permissions and persistent JSON storage. Test data isolated from the real installation.",
  );
} finally {
  child.kill();
}

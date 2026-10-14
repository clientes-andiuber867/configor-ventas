import { createServer } from "node:http";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { verifyWholesale } from "./wholesale-cases.mjs";
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
const bankPayments = new Map();
let generated = 0;
const bank = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/api/authentication/encrypt"))
    return res.end(JSON.stringify("encrypted-test"));
  if (req.url === "/api/authentication/authenticate")
    return res.end(JSON.stringify({ responseCode: 0, token: "test-token" }));
  if (req.url === "/api/qrsimple/generateQR") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const payload = JSON.parse(raw);
    assert.equal(payload.currency, "BOB");
    assert.equal(payload.singleUse, true);
    assert.equal(payload.modifyAmount, false);
    assert.match(payload.transactionId, /^Q[0-9a-f]{32}$/);
    assert.match(payload.description, /^C\d{6}$/);
    const qrId = "bank-" + ++generated;
    bankPayments.set(qrId, { amount: payload.amount, paid: false, payload });
    return res.end(
      JSON.stringify({ responseCode: 0, qrId, qrImage: "test-image" }),
    );
  }
  if (req.url === "/api/qrsimple/cancelQR") {
    assert.equal(req.method, "DELETE");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const p = bankPayments.get(JSON.parse(raw).qrId);
    if (p.failCancel) return res.end(JSON.stringify({ responseCode: 5 }));
    if (p.payDuringCancel) p.paid = true;
    if (p.paid) return res.end(JSON.stringify({ responseCode: 1 }));
    p.cancelled = true;
    return res.end(JSON.stringify({ responseCode: 0 }));
  }
  const payment = bankPayments.get(
    decodeURIComponent(req.url.split("/").at(-1)),
  );
  return res.end(
    JSON.stringify({
      responseCode: 0,
      statusQrCode: payment?.paid ? 1 : payment?.cancelled ? 9 : 0,
      payment: payment?.paid ? [{ amount: payment.amount }] : [],
    }),
  );
});
await new Promise((resolve) => bank.listen(0, "127.0.0.1", resolve));
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
      BANECO_BASE_URL: "http://127.0.0.1:" + bank.address().port,
      BANECO_USER: "test",
      BANECO_PASSWORD: "test",
      BANECO_ACCOUNT: "test",
      BANECO_AES_KEY: "test",
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
  const attemptFile = path.join(directory, "login-attempts.json");
  const adminKey = createHash("sha256").update("admin").digest("hex");
  const login = (value, role = "admin", username = "admin") => ({
    action: "login",
    username,
    password: value,
    role,
  });
  // Advance only the isolated fixture's persisted deadline, never real time/data.
  async function expireTestLock() {
    const records = JSON.parse(await readFile(attemptFile, "utf8"));
    records[adminKey].blockedUntil = 0;
    await writeFile(attemptFile, JSON.stringify(records));
  }
  for (const minutes of [5, 15, 30, 60, 120, 240, 480, 960, 1440, 1440]) {
    const first = await request("/api/auth", login("x"), "", 401);
    assert.equal(first.data.attemptsRemaining, 2);
    const second = await request(
      "/api/auth",
      login("incorrecta", "cashier", " ADMIN "),
      "",
      401,
    );
    assert.equal(second.data.attemptsRemaining, 1);
    const third = await request("/api/auth", login("incorrecta"), "", 429);
    assert(
      third.data.retryAfter <= minutes * 60 &&
        third.data.retryAfter >= minutes * 60 - 2,
    );
    const blocked = await request("/api/auth", login(password), "", 429);
    assert.equal(blocked.data.blockedUntil, third.data.blockedUntil);
    assert(
      !blocked.cookie,
      "No session while blocked, even with correct password",
    );
    const stored = JSON.parse(await readFile(attemptFile, "utf8"));
    assert.equal(stored[adminKey].blockedUntil, third.data.blockedUntil);
    assert(!JSON.stringify(stored).includes(password));
    await expireTestLock();
  }
  const unlocked = await request("/api/auth", login(password));
  await request("/api/auth", { action: "logout" }, unlocked.cookie);
  assert.equal(
    JSON.parse(await readFile(attemptFile, "utf8"))[adminKey],
    undefined,
  );
  const burst = await Promise.all(
    Array.from({ length: 6 }, () =>
      fetch(base + "/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify(login("incorrecta")),
      }),
    ),
  );
  assert.deepEqual(
    burst.map((r) => r.status).sort(),
    [401, 401, 429, 429, 429, 429],
  );
  const afterReset = await request("/api/auth", login(password), "", 429);
  assert(
    afterReset.data.retryAfter <= 300 && afterReset.data.retryAfter >= 298,
  );
  await request(
    "/api/auth",
    login("incorrecta", "admin", "another-user"),
    "",
    401,
  );
  await expireTestLock();
  const resetSession = await request("/api/auth", login(password));
  await request("/api/auth", { action: "logout" }, resetSession.cookie);
  const beforeCleanLogin = await stat(attemptFile);
  const cleanSession = await request("/api/auth", login(password));
  assert.equal(
    (await stat(attemptFile)).mtimeMs,
    beforeCleanLogin.mtimeMs,
    "Clean successful login must not rewrite the lockout file",
  );
  await request("/api/auth", { action: "logout" }, cleanSession.cookie);
  console.log(
    "PASS: three failures, normalized account, progressive 5/15/30/60-minute locks through 24h cap, persistence, correct-password blocking, concurrency, account isolation and successful reset.",
  );
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
  await request("/api/cash-register", null, "", 401);
  const closedAttempt = {
    action: "sale",
    id: crypto.randomUUID(),
    items: [
      {
        code: "0470101",
        barcode: "04701019",
        grams: 100,
        amount: 1000,
        source: "manual",
      },
    ],
    cash: 1000,
    qr: 0,
  };
  await request("/api/data", closedAttempt, cashierCookie, 409);
  await request(
    "/api/payments",
    { ...closedAttempt, cash: 0, qr: 1000 },
    cashierCookie,
    409,
  );
  assert.equal(generated, 0, "Closed register must not contact the bank");
  const shiftId = crypto.randomUUID();
  const opening = {
    action: "open",
    id: shiftId,
    amount: 10000,
    note: "Fondo inicial",
  };
  await request(
    "/api/cash-register",
    { ...opening, amount: -1 },
    cashierCookie,
    400,
  );
  const opened = await Promise.all([
    request("/api/cash-register", opening, cashierCookie),
    request("/api/cash-register", opening, cashierCookie),
  ]);
  assert.equal(opened[0].data.active.id, opened[1].data.active.id);
  await request(
    "/api/cash-register",
    { ...opening, id: crypto.randomUUID() },
    cashierCookie,
    409,
  );
  await request(
    "/api/cash-register",
    { action: "close", id: shiftId, amount: 10000, note: "" },
    adminCookie,
    404,
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
  const mixed = { ...labelSale, id: crypto.randomUUID(), cash: 1000, qr: 630 };
  await request("/api/payments", mixed, "", 401);
  // A cashier's checkbox cannot replace bank verification.
  await request(
    "/api/data",
    { ...mixed, qrConfirmed: true },
    cashierCookie,
    400,
  );
  const intents = await Promise.all([
    request("/api/payments", mixed, cashierCookie),
    request("/api/payments", mixed, cashierCookie),
  ]);
  assert.equal(generated, 1, "Only one bank request for concurrent generation");
  const intent = (
    await request("/api/payments?id=" + mixed.id, null, cashierCookie)
  ).data;
  assert.equal(intent.amount, 630);
  assert.equal(intent.reference, intents[0].data.reference);
  assert.equal(bankPayments.get(intent.qrId).payload.amount, 6.3);
  await request("/api/payments?id=" + mixed.id, null, adminCookie, 404);
  await request(
    "/api/payments",
    { ...mixed, cash: 500, qr: 1130 },
    cashierCookie,
    409,
  );
  await request(
    "/api/data",
    { ...mixed, qrConfirmed: true },
    cashierCookie,
    400,
  );
  bankPayments.get(intent.qrId).paid = true;
  bankPayments.get(intent.qrId).amount = 1;
  await request("/api/data", mixed, cashierCookie, 409);
  bankPayments.get(intent.qrId).amount = 6.3;
  const status = (
    await request("/api/payments?id=" + mixed.id, null, cashierCookie)
  ).data;
  assert.equal(status.paid, true);
  const saved = await Promise.all([
    request("/api/data", mixed, cashierCookie),
    request("/api/data", mixed, cashierCookie),
  ]);
  assert.equal(saved[0].data.sale.reference, intent.saleReference);
  assert.equal(saved[0].data.sale.qr_id, intent.qrId);
  const allQr = { ...labelSale, id: crypto.randomUUID(), cash: 0, qr: 1630 };
  const full = (await request("/api/payments", allQr, cashierCookie)).data;
  assert.equal(bankPayments.get(full.qrId).payload.amount, 16.3);
  assert.notEqual(full.reference, intent.reference);
  bankPayments.get(full.qrId).paid = true;
  await request("/api/data", allQr, cashierCookie);
  await request(
    "/api/data",
    { ...allQr, id: crypto.randomUUID(), qrConfirmed: true },
    cashierCookie,
    400,
  );
  console.log(
    "PASS: dynamic QR, exact mixed/full amounts, sequential references, authenticated ownership, bank confirmation, amount mismatch, concurrent generation and idempotent sale registration.",
  );
  const editable = { ...allQr, id: crypto.randomUUID() };
  const pending = (await request("/api/payments", editable, cashierCookie))
    .data;
  await request(
    "/api/cash-register",
    {
      action: "close",
      id: shiftId,
      amount: 10000,
      note: "No cerrar con QR pendiente",
    },
    cashierCookie,
    409,
  );
  const cancellation = { action: "cancel", id: editable.id };
  await request("/api/payments", cancellation, "", 401);
  await request("/api/payments", cancellation, adminCookie, 404);
  bankPayments.get(pending.qrId).failCancel = true;
  await request("/api/payments", cancellation, cashierCookie, 500);
  assert.equal(
    (await request("/api/payments?id=" + editable.id, null, cashierCookie)).data
      .cancelled,
    false,
  );
  bankPayments.get(pending.qrId).failCancel = false;
  const nextBeforeCancellation = pending.saleReference;
  const cancelled = (
    await request("/api/payments", cancellation, cashierCookie)
  ).data;
  assert.equal(cancelled.cancelled, true);
  assert.equal(bankPayments.get(pending.qrId).cancelled, true);
  assert.equal(
    (await request("/api/payments", cancellation, cashierCookie)).data
      .cancelled,
    true,
  );
  await request("/api/data", editable, cashierCookie, 409);
  await request("/api/payments", editable, cashierCookie, 409);
  assert(
    !(await request("/api/data", null, cashierCookie)).data.sales.some(
      (x) => x.id === editable.id,
    ),
    "Cancelling a QR does not register a sale",
  );
  const cashAfterCancel = {
    ...editable,
    id: crypto.randomUUID(),
    cash: 1630,
    qr: 0,
  };
  const cashSaved = (await request("/api/data", cashAfterCancel, cashierCookie))
    .data.sale;
  assert.equal(
    cashSaved.reference,
    nextBeforeCancellation,
    "Cancelled QR does not consume a sale number",
  );
  const changed = {
    ...editable,
    id: crypto.randomUUID(),
    items: [...editable.items, ...editable.items],
    qr: 3260,
  };
  const regenerated = (await request("/api/payments", changed, cashierCookie))
    .data;
  assert.equal(regenerated.amount, 3260);
  assert.notEqual(regenerated.reference, pending.reference);
  // A payment arriving during cancellation must win: keep the original sale payable.
  bankPayments.get(regenerated.qrId).payDuringCancel = true;
  const race = (
    await request(
      "/api/payments",
      { action: "cancel", id: changed.id },
      cashierCookie,
    )
  ).data;
  assert.equal(race.paid, true);
  assert.equal(race.cancelled, false);
  await request("/api/data", changed, cashierCookie);
  assert.equal(
    (
      await request(
        "/api/payments",
        { action: "cancel", id: changed.id },
        cashierCookie,
      )
    ).data.paid,
    true,
  );
  const numberedSales = (await request("/api/data", null, cashierCookie)).data
    .sales;
  const numbers = numberedSales
    .map((x) => Number(x.reference.slice(1)))
    .sort((a, b) => a - b);
  assert.deepEqual(
    numbers,
    numbers.map((_, i) => i + 1),
    "Committed sales have no gaps despite cancelled/failed/retried payments",
  );
  const concurrentCash = [crypto.randomUUID(), crypto.randomUUID()].map(
    (id) => ({ ...cashAfterCancel, id }),
  );
  const results = await Promise.all(
    concurrentCash.map((sale) => request("/api/data", sale, cashierCookie)),
  );
  assert.notEqual(
    results[0].data.sale.reference,
    results[1].data.sale.reference,
  );
  console.log(
    "PASS: cancellation, failed cancellation, ownership, repeat cancellation, no sale before payment, new cash/edited QR purchase, payment racing cancellation.",
  );
  const snapshot = (await request("/api/cash-register", null, cashierCookie))
    .data.active;
  const shiftSales = (
    await request("/api/data", null, cashierCookie)
  ).data.sales.filter((s) => s.status === "completed");
  assert(shiftSales.every((s) => s.cash_session_id === shiftId));
  assert.equal(
    snapshot.cash_sales,
    shiftSales.reduce((sum, s) => sum + s.cash, 0),
  );
  assert.equal(
    snapshot.qr_sales,
    shiftSales.reduce((sum, s) => sum + s.qr, 0),
  );
  assert.equal(snapshot.expected, 10000 + snapshot.cash_sales);
  await request(
    "/api/cash-register",
    { action: "close", id: shiftId, amount: snapshot.expected - 100, note: "" },
    cashierCookie,
    409,
  );
  const closing = {
    action: "close",
    id: shiftId,
    amount: snapshot.expected - 100,
    note: "Falta un boliviano al contar",
  };
  const closed = (await request("/api/cash-register", closing, cashierCookie))
    .data;
  assert.equal(closed.active, null);
  await request(
    "/api/data",
    { ...closedAttempt, id: crypto.randomUUID() },
    cashierCookie,
    409,
  );
  await request(
    "/api/payments",
    { ...closedAttempt, id: crypto.randomUUID(), cash: 0, qr: 1000 },
    cashierCookie,
    409,
  );
  // A retry of a committed sale is still idempotent after closing its shift.
  assert.equal(
    (await request("/api/data", sale, cashierCookie)).data.sale.id,
    sale.id,
  );
  assert.equal(closed.history[0].difference, -100);
  assert.equal(closed.history[0].qr_sales, snapshot.qr_sales);
  const repeatClose = (
    await request(
      "/api/cash-register",
      { ...closing, amount: 0 },
      cashierCookie,
    )
  ).data;
  assert.equal(repeatClose.history[0].counted, closing.amount);
  const newShift = { ...opening, id: crypto.randomUUID(), amount: 0 };
  await request("/api/cash-register", newShift, cashierCookie);
  assert.equal(
    (await request("/api/cash-register", closing, cashierCookie)).data.active
      .id,
    newShift.id,
  );
  await request(
    "/api/cash-register",
    { action: "close", id: newShift.id, amount: 0, note: "" },
    cashierCookie,
  );
  assert.equal(
    (await request("/api/cash-register?history=1", null, adminCookie)).data
      .history.length,
    2,
  );
  // Seed an old sale only into this isolated fixture to exercise API permission boundaries.
  const oldFixture = JSON.parse(
    await readFile(path.join(directory, "configor.json"), "utf8"),
  );
  const historicalId = crypto.randomUUID();
  oldFixture.sales.push({
    ...oldFixture.sales[0],
    id: historicalId,
    created: "2001-01-01T12:00:00Z",
    cash_session_id: null,
  });
  await writeFile(
    path.join(directory, "configor.json"),
    JSON.stringify(oldFixture),
  );
  for (const scope of ["", "&scope=sales"]) {
    const visible = (
      await request(
        "/api/data?from=2000-01-01&to=2100-01-01" + scope,
        null,
        cashierCookie,
      )
    ).data.sales;
    assert(
      !visible.some((s) => s.id === historicalId),
      "Historical sale leaked to cashier",
    );
    assert(visible.length > 0, "Today remains visible to cashier");
    const all = (
      await request(
        "/api/data?from=2000-01-01&to=2100-01-01" + scope,
        null,
        adminCookie,
      )
    ).data.sales;
    assert(
      all.some((s) => s.id === historicalId),
      "Admin can see historical sales",
    );
  }
  console.log(
    "PASS: cash register ownership, idempotent opening/closing, cash/QR separation, void exclusion, discrepancy notes, persisted history and server-side daily cashier restriction.",
  );
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
  await verifyWholesale({
    request,
    adminCookie,
    cashierCookie,
    labelSale,
    directory,
    bankPayments,
  });
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
  bank.closeAllConnections();
  bank.close();
}

// Exercise production HTTP handlers with VERCEL=1, no writable data directory,
// and an isolated Supabase protocol fixture. SQL semantics are tested separately.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
const directory = path.resolve(
  "tests/.local-data/cloud-" + crypto.randomUUID(),
);
await mkdir(directory, { recursive: true });
const noDisk = path.join(directory, "not-a-directory");
await writeFile(noDisk, "Filesystem persistence is forbidden in this test.");
const password = "Test-" + crypto.randomUUID(),
  salt = randomBytes(16).toString("hex");
const member = {
  email: "admin",
  name: "Cloud Test",
  role: "admin",
  active: 1,
  passwordHash: salt + ":" + scryptSync(password, salt, 64).toString("hex"),
};
const records = new Map(),
  sessions = new Map();
let deletes = 0,
  unavailable = false;
const backend = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader("Content-Type", "application/json");
    if (unavailable) {
      res.statusCode = 503;
      return res.end("{}");
    }
    const name = url.pathname.split("/").at(-1);
    if (name === "configor_login_claim") {
      const r = records.get(body.p_account) || {
        failures: 0,
        level: 0,
        blockedUntil: 0,
        lease: null,
      };
      records.set(body.p_account, r);
      if (r.blockedUntil > Date.now())
        return res.end(
          JSON.stringify({ status: "blocked", blockedUntil: r.blockedUntil }),
        );
      if (r.lease) return res.end('{"status":"busy"}');
      r.lease = body.p_lease;
      return res.end('{"status":"allowed"}');
    }
    if (name === "configor_login_complete") {
      const r = records.get(body.p_account);
      if (!r || r.lease !== body.p_lease)
        return res.end('{"status":"expired"}');
      r.lease = null;
      if (body.p_outcome === "success")
        Object.assign(r, { failures: 0, level: 0, blockedUntil: 0 });
      if (body.p_outcome === "failure" && ++r.failures === 3) {
        r.blockedUntil =
          Date.now() +
          (r.level ? Math.min(1440, 15 * 2 ** (r.level - 1)) : 5) * 60000;
        r.level++;
        r.failures = 0;
      }
      return res.end(
        JSON.stringify({
          status: r.blockedUntil > Date.now() ? "blocked" : "allowed",
          blockedUntil: r.blockedUntil,
          attemptsRemaining: 3 - r.failures,
        }),
      );
    }
    if (name === "configor_members")
      return res.end(
        JSON.stringify(
          url.searchParams.get("email") === "eq.admin" ? [member] : [],
        ),
      );
    if (name === "configor_sessions") {
      if (req.method === "POST") sessions.set(body.tokenHash, body);
      if (req.method === "DELETE") {
        if (url.searchParams.has("expires")) deletes++;
        else sessions.delete(url.searchParams.get("tokenHash")?.slice(3));
      }
      res.statusCode = 204;
      return res.end();
    }
    if (name === "configor_auth_user")
      return res.end(
        JSON.stringify(
          sessions.has(body.p_token)
            ? { ...member, passwordHash: undefined }
            : null,
        ),
      );
    res.statusCode = 404;
    res.end('{"error":"Unexpected fixture request"}');
  } catch {
    res.statusCode = 500;
    res.end("{}");
  }
});
await new Promise((r) => backend.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:3007";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3007",
  ],
  {
    env: {
      ...process.env,
      VERCEL: "1",
      CONFIGOR_STORAGE: "supabase",
      CONFIGOR_DATA_DIR: noDisk,
      SUPABASE_URL: "http://127.0.0.1:" + backend.address().port,
      SUPABASE_SECRET_KEY: "sb_secret_test_fixture",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (output += d));
async function request(body, cookie = "") {
  return fetch(base + "/api/auth", {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const login = (value, role = "admin") => ({
  action: "login",
  username: "admin",
  password: value,
  role,
});
try {
  let up = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) {
        up = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(up, output);
  assert.equal((await request()).status, 401);
  for (let i = 0; i < 2; i++)
    assert.equal((await request(login("wrong"))).status, 401);
  assert.equal((await request(login("wrong"))).status, 429);
  assert.equal((await request(login(password))).status, 429);
  for (const r of records.values()) r.blockedUntil = 0;
  assert.equal((await request(login(password, "cashier"))).status, 403);
  assert(
    [...records.values()].every((r) => r.lease === null),
    "Role error must release lease",
  );
  for (let i = 0; i < 2; i++) {
    const response = await request(login(password));
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.equal((await request(null, cookie)).status, 200);
    assert.equal((await request({ action: "logout" }, cookie)).status, 200);
    assert.equal((await request(null, cookie)).status, 401);
  }
  assert.equal(
    deletes,
    1,
    "Expired-session cleanup should run once per process/hour",
  );
  assert([...records.values()].every((r) => r.level === 0 && r.failures === 0));
  unavailable = true;
  const failure = await request(login(password));
  assert(!failure.ok);
  assert(!failure.headers.has("set-cookie"), "Storage outage must fail closed");
  console.log(
    "PASS: Vercel cloud authentication without filesystem writes, lockouts, role-error release, success/reset, cookies, logout, one hourly cleanup and fail-closed outage.",
  );
} finally {
  child.kill();
  await new Promise((r) => child.once("exit", r));
  backend.closeAllConnections();
  await new Promise((r) => backend.close(r));
}

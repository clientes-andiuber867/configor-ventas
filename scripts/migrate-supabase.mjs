// Run after applying supabase/migrations/*.sql. Secrets are read only from .env.local.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const base = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SECRET_KEY;
if (!base || !key)
  throw Error("Missing private Supabase environment configuration");
const headers = {
  apikey: key,
  ...(!key.startsWith("sb_secret_") ? { Authorization: "Bearer " + key } : {}),
};
async function request(resource, init = {}) {
  const r = await fetch(base + resource, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!r.ok)
    throw Error("Supabase migration failed: " + r.status + " " + resource);
  const text = await r.text();
  return text ? JSON.parse(text) : undefined;
}
const state = JSON.parse(await readFile("data/configor.json", "utf8"));
const records = {
  members: state.members,
  products: state.products,
  sales: state.sales,
  sessions: state.sessions.filter((x) => x.expires > Date.now()),
  settings: [
    { id: "owner", value: state.owner },
    { id: "rule", value: state.rule },
    { id: "payments", value: state.payments },
  ],
};
const keys = {
  members: "email",
  products: "code",
  sales: "id",
  sessions: "tokenHash",
  settings: "id",
};
await mkdir("data/backups", { recursive: true });
await writeFile(
  "data/backups/migration-" + Date.now() + ".json",
  JSON.stringify(state, null, 2),
  { mode: 0o600 },
);
// Resume safely: existing matching records are retained; conflicting data aborts.
for (const [table, rows] of Object.entries(records)) {
  const existing = await request("/rest/v1/configor_" + table + "?limit=1000");
  for (const old of existing) {
    const source = rows.find((x) => x[keys[table]] === old[keys[table]]);
    if (!source) {
      if (table === "sessions") continue;
      throw Error("Target contains additional records: " + table);
    }
    for (const [field, value] of Object.entries(source)) {
      if (field === "created")
        assert.equal(Date.parse(old[field]), Date.parse(value));
      else
        assert.deepEqual(
          old[field],
          value,
          "Conflict in " + table + " / " + field,
        );
    }
  }
  if (rows.length)
    await request("/rest/v1/configor_" + table, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
  const saved = await request("/rest/v1/configor_" + table + "?limit=1000");
  for (const row of rows) {
    const found = saved.find((x) => x[keys[table]] === row[keys[table]]);
    assert(found);
    for (const [field, value] of Object.entries(row)) {
      if (field === "created")
        assert.equal(Date.parse(found[field]), Date.parse(value));
      else assert.deepEqual(found[field], value);
    }
  }
  console.log(table + ": " + rows.length + " verified");
}
const qr = state.payments.qrKey;
if (qr) {
  assert(/^[-a-f0-9]+\.(png|jpeg|webp)$/.test(qr));
  const bytes = await readFile(path.join("data/uploads", qr));
  const r = await fetch(base + "/storage/v1/object/configor-payments/" + qr, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "image/" + qr.split(".").at(-1),
      "x-upsert": "true",
    },
    body: bytes,
  });
  assert(r.ok, "QR upload");
  const downloaded = await fetch(
    base + "/storage/v1/object/authenticated/configor-payments/" + qr,
    { headers },
  );
  assert(downloaded.ok);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  console.log("Private QR: bytes verified");
}
console.log("Migration verified. Local data preserved.");

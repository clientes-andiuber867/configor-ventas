import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson } from "../lib/atomic-file.ts";
const dir = path.resolve("tests/.local-data/storage-" + crypto.randomUUID());
await mkdir(dir, { recursive: true });
const file = path.join(dir, "state.json");
await atomicWriteJson(file, {
  recipient: "Anterior",
  sales: [{ total: 1630 }],
});
let attempts = 0;
const next = { recipient: "Actualizado", sales: [{ total: 1630 }] };
await atomicWriteJson(file, next, async (from, to) => {
  assert.deepEqual(JSON.parse(await readFile(to, "utf8")), {
    recipient: "Anterior",
    sales: [{ total: 1630 }],
  });
  if (++attempts < 4)
    throw Object.assign(new Error("Locked"), { code: "EPERM" });
  await rename(from, to);
});
assert.equal(attempts, 4);
assert.deepEqual(JSON.parse(await readFile(file, "utf8")), next);
await assert.rejects(
  atomicWriteJson(file, { recipient: "No guardado" }, async () => {
    throw Object.assign(new Error("Locked"), { code: "EBUSY" });
  }),
  /No se pudieron guardar/,
);
assert.deepEqual(JSON.parse(await readFile(file, "utf8")), next);
assert.deepEqual(await readdir(dir), ["state.json"]);
console.log(
  "PASS: temporary Windows locks retried; persistent lock preserves committed data and cleans temporary file.",
);

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readCatalog } from "../features/catalog/import.ts";
const csv = (text) => new File([text], "catalogo.csv");
const header = "PLU NO;Name;Code;Price;Mode\n";
assert.deepEqual(await readCatalog(csv(header + "1;BLANDA 1RO;0470101;68;0")), [
  {
    plu: "1",
    name: "BLANDA 1RO",
    code: "0470101",
    price: 6800,
    mode: "weight",
  },
]);
await assert.rejects(
  readCatalog(csv(header + "1;Uno;0470101;68;weight\n2;Dos;0470101;70;weight")),
  /duplicados/,
);
await assert.rejects(
  readCatalog(csv(header + "1;Uno;0470101;68;1")),
  /por peso/,
);
assert.equal(
  (await readCatalog(csv(header + "1;PUNTA DE S\x01;0470103;12,5;0")))[0].name,
  "PUNTA DE S",
);
if (process.argv[2]) {
  const rows = await readCatalog(
    new File([await readFile(process.argv[2])], "catalogoo.xls"),
  );
  assert.equal(rows.length, 41);
  assert.equal(rows[0].code, "0470101");
  assert.equal(rows[0].price, 6800);
  assert(rows.some((p) => p.code === "0000000"));
  assert(rows.every((p) => !/[\x00-\x1f]/.test(p.name)));
  console.log(
    "PASS: catalogoo.xls, 41 productos, ceros iniciales, precio 68, Mode 0 y limpieza de nombres.",
  );
}
console.log("PASS: validación CSV, modos y códigos duplicados.");

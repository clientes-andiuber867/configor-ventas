import { utils, writeFile } from "xlsx";
const w = utils.book_new();
utils.book_append_sheet(
  w,
  utils.aoa_to_sheet([
    ["PLU NO", "Name", "Code", "Price", "Mode", "Shelflife"],
    [1, "BLANDA 1RO", "0470101", 70, "weight", 0],
  ]),
  "Productos",
);
writeFile(w, "tests/productos-prueba.xlsx");

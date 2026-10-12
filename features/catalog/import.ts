import type { Product } from "@/lib/domain";
export async function readCatalog(
  file: Pick<File, "name" | "size" | "arrayBuffer" | "text">,
): Promise<Product[]> {
  if (file.size > 4 * 1024 * 1024)
    throw Error("El archivo no puede superar 4 MB.");
  let rows: any[][] = [];
  if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const book = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      sheetRows: 502,
    });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw Error("El archivo no contiene hojas.");
    rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });
  } else if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const sep = file.name.endsWith(".tsv")
      ? "\t"
      : text.split("\n")[0].includes(";")
        ? ";"
        : ",";
    rows = parseCSV(text, sep);
  } else throw Error("Usa Excel .xls, .xlsx, CSV o TSV.");
  if (rows.length < 2) throw Error("No hay productos para importar.");
  const header = rows[0].map((v) =>
    String(v ?? "")
      .trim()
      .toLowerCase()
      .replace(/[ _]/g, ""),
  );
  const idx = (keys: string[]) => header.findIndex((h) => keys.includes(h));
  const ci = idx(["code", "codigo", "código"]),
    ni = idx(["name", "nombre", "producto"]),
    pi = idx(["price", "precio"]),
    pli = idx(["pluno", "plu"]),
    mi = idx(["mode", "modo"]);
  if ([ci, ni, pi].some((i) => i < 0))
    throw Error(
      "Faltan columnas Code, Name y Price (código, nombre y precio).",
    );
  const parsed = rows
    .slice(1)
    .filter((r) => r.some((v) => v !== null && v !== undefined && v !== ""))
    .map((r, i) => {
      if (typeof r[ci] === "number")
        throw Error(
          "Fila " +
            (i + 2) +
            ": el código está guardado como número. Formatea Code como texto para conservar los ceros iniciales.",
        );
      const code = String(r[ci] ?? "").trim(),
        name = String(r[ni] ?? "")
          .replace(/[\x00-\x1f\x7f]/g, "")
          .trim(),
        price = Math.round(Number(String(r[pi] ?? "").replace(",", ".")) * 100);
      if (
        !/^\d{4,16}$/.test(code) ||
        !name ||
        !Number.isFinite(price) ||
        price <= 0
      )
        throw Error("Fila " + (i + 2) + ": revisa código, nombre o precio.");
      if (
        mi >= 0 &&
        r[mi] &&
        !["0", "weight", "peso"].includes(String(r[mi]).trim().toLowerCase())
      )
        throw Error(
          "Fila " + (i + 2) + ": solo se admiten productos por peso.",
        );
      return {
        code,
        name,
        price,
        plu: String(pli >= 0 ? (r[pli] ?? i + 1) : i + 1),
        mode: "weight",
      };
    });
  if (parsed.length > 500)
    throw Error("Importa un máximo de 500 productos por archivo.");
  if (new Set(parsed.map((p) => p.code)).size !== parsed.length)
    throw Error("Hay códigos duplicados en el archivo.");
  return parsed;
}
function parseCSV(text: string, sep: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (quoted) throw Error("CSV con comillas sin cerrar.");
  return rows;
}

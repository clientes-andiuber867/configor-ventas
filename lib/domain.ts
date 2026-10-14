export type Product = {
  code: string;
  plu: string;
  name: string;
  price: number;
  mode: string;
};
export type Line = {
  id: string;
  code: string;
  name: string;
  barcode: string;
  grams: number | null;
  amount: number;
  source: "label" | "manual";
};
export type Sale = {
  wholesale_customer_id?: string | null;
  wholesale_customer_name?: string | null;
  cash_session_id?: string | null;
  reference?: string;
  qr_id?: string;
  id: string;
  created: string;
  cashier: string;
  total: number;
  cash: number;
  qr: number;
  items: Line[];
  status: string;
  void_reason?: string;
  qr_recipient?: string;
};
export type Member = {
  email: string;
  name: string;
  role: string;
  active: number;
  password?: string;
};
export type BarcodeRule = {
  enabled: boolean;
  pattern: string;
  amountDecimals: number;
  weightDecimals: number;
  prefix: string;
  checksum: "none" | "ean";
  codePad: number;
};
export const defaultRule: BarcodeRule = {
  enabled: false,
  pattern: "FWWWWWWEEEEENNNNNC",
  amountDecimals: 2,
  weightDecimals: 3,
  prefix: "",
  checksum: "none",
  codePad: 7,
};
const boliviaMoney = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const money = (c: number) => "Bs " + boliviaMoney.format(c / 100);
const boliviaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const today = () => boliviaDate.format(new Date());
export function dayOf(s: string) {
  return boliviaDate.format(new Date(s));
}
export function eanValid(s: string) {
  if (!/^\d+$/.test(s)) return false;
  let sum = 0;
  for (let i = s.length - 2, j = 0; i >= 0; i--, j++)
    sum += Number(s[i]) * (j % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(s.at(-1));
}
export function decodeBarcode(
  raw: string,
  products: Product[],
  rule: BarcodeRule,
) {
  const code = raw.trim();
  if (!/^\d{4,32}$/.test(code))
    throw Error("El código debe tener entre 4 y 32 dígitos.");
  const exact = products.find((p) => p.code === code);
  if (exact) return { product: exact, amount: null, grams: null };
  if (code.length === 8 && eanValid(code)) {
    const p = products.find((p) => p.code === code.slice(0, -1));
    if (p) return { product: p, amount: null, grams: null };
  }
  if (!rule.enabled)
    throw Error(
      "Código no reconocido. Importa el producto o configura el formato de la balanza en Base de datos.",
    );
  if (code.length !== rule.pattern.length)
    throw Error("La longitud no coincide con el formato configurado.");
  if (rule.checksum === "ean" && !eanValid(code))
    throw Error("Dígito de control inválido.");
  const part = (letter: string) =>
    [...rule.pattern].map((x, i) => (x === letter ? code[i] : "")).join("");
  if (rule.prefix && part("F") !== rule.prefix)
    throw Error("El prefijo no corresponde a esta balanza.");
  const id = part("W");
  const p = products.find((p) => p.code === id.padStart(rule.codePad, "0"));
  if (!p) throw Error("Producto " + id + " no encontrado en la base de datos.");
  const amount = part("E")
    ? Math.round((Number(part("E")) * 100) / 10 ** rule.amountDecimals)
    : null;
  const grams = part("N")
    ? Math.round((Number(part("N")) * 1000) / 10 ** rule.weightDecimals)
    : null;
  if (amount !== null && amount <= 0)
    throw Error("La etiqueta contiene un importe inválido.");
  if (grams !== null && grams <= 0)
    throw Error("La etiqueta contiene un peso inválido.");
  return { product: p, amount, grams };
}
export const referenceProducts: Product[] = [
  "BLANDA 1RO",
  "BLANDA 2DO",
  "PUNTA S",
  "COLGADURA",
  "TIRA COSTILLA",
  "COLA",
  "HUESO SOPA",
  "CHULETA",
  "HUESO BLANCO",
  "OSO BUCO",
  "POLLERITA C 4",
  "PECETO",
  "LOMITO",
  "CARNE MOLIDA",
  "GIBA",
].map((name, i) => ({
  name,
  plu: String(i + 1),
  code: "04701" + String(i + 1).padStart(2, "0"),
  price: [70, 60, 75, 75, 75, 35, 32, 58, 15, 42, 75, 75, 80, 58, 75][i] * 100,
  mode: "weight",
}));

// Only committed sales consume a number, including sales subsequently voided.
export function nextSaleReference(sales: Pick<Sale, "reference">[]) {
  const next =
    sales.reduce(
      (max, sale) =>
        /^C[0-9]+$/.test(sale.reference || "")
          ? Math.max(max, Number(sale.reference!.slice(1)))
          : max,
      0,
    ) + 1;
  return "C" + String(next).padStart(6, "0");
}

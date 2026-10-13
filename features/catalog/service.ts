import { HttpError } from "@/features/auth/server";
import { importProducts } from "@/features/catalog/repository";
import { saveSetting } from "@/features/workspace/repository";
import { z } from "zod";
const productSchema = z.object({
  code: z.string().regex(/^\d{4,16}$/),
  plu: z.string().max(20),
  name: z.string().trim().min(1).max(100),
  price: z.number().int().positive().max(10000000),
  mode: z.literal("weight"),
});
const ruleSchema = z.object({
  enabled: z.boolean(),
  pattern: z
    .string()
    .regex(/^F*W+E*N*C?$/)
    .min(4)
    .max(32),
  amountDecimals: z.number().int().min(0).max(4),
  weightDecimals: z.number().int().min(0).max(4),
  prefix: z.string().regex(/^\d*$/),
  checksum: z.enum(["none", "ean"]),
  codePad: z.number().int().min(4).max(16),
});
export async function importCatalog(input: unknown) {
  const products = z.array(productSchema).min(1).max(500).parse(input);
  if (new Set(products.map((p) => p.code)).size !== products.length)
    throw new HttpError(400, "Hay códigos duplicados.");
  await importProducts(products);
  return { count: products.length };
}
export async function configureRule(input: unknown) {
  const rule = ruleSchema.parse(input);
  if (
    rule.prefix &&
    rule.prefix.length !== [...rule.pattern].filter((c) => c === "F").length
  )
    throw new HttpError(400, "La longitud del prefijo no coincide con F.");
  await saveSetting("rule", rule);
  return { ok: true };
}

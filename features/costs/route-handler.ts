import { authorize, checkOrigin, HttpError } from "@/features/auth/server";
import { apiError } from "@/lib/http/errors";
import { z } from "zod";
import { readCosts, saveCosts } from "./repository";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  try {
    await authorize(true);
    return Response.json(await readCosts(), { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await authorize(true);
    const raw = await req.text();
    if (raw.length > 40000) throw new HttpError(413, "Demasiados conceptos.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Datos inválidos.");
    }
    const sheet = z
      .object({
        version: z.union([z.literal(""), z.string().uuid()]),
        items: z
          .array(
            z.object({
              id: z.string().uuid(),
              name: z.string().trim().min(1).max(80),
              cents: z.number().int().min(0).max(10000000),
              quantity: z.number().int().min(1).max(10000),
            }),
          )
          .max(100),
      })
      .parse(body);
    if (new Set(sheet.items.map((i) => i.id)).size !== sheet.items.length)
      throw new HttpError(400, "Hay conceptos duplicados.");
    return Response.json(await saveCosts(sheet), { headers });
  } catch (e) {
    return apiError(e);
  }
}

import { authorize, checkOrigin, HttpError } from "@/features/auth/server";
import { apiError } from "@/lib/http/errors";
import { z } from "zod";
import {
  createCustomer,
  customerHistory,
  findCustomer,
  listCustomers,
} from "./repository";
const headers = { "Cache-Control": "no-store" };
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(400, "Los datos enviados no son válidos.");
  }
}
const cursorSchema = z.object({
  created: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});
export async function GET(req: Request) {
  try {
    const user = await authorize();
    const params = new URL(req.url).searchParams;
    if (params.has("customer")) {
      const id = z.string().uuid().parse(params.get("customer"));
      const cursor = params.has("cursor")
        ? cursorSchema.parse(parseJson(params.get("cursor")!))
        : null;
      const [customer, history] = await Promise.all([
        findCustomer(id),
        customerHistory(id, cursor, user.role === "admin"),
      ]);
      if (!customer) throw new HttpError(404, "Cliente no encontrado.");
      return Response.json(
        {
          customer,
          ...history,
        },
        { headers },
      );
    }
    const search = z
      .string()
      .trim()
      .max(100)
      .parse(params.get("q") || "");
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .parse(params.get("offset") || 0);
    return Response.json(await listCustomers(search, offset), { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await authorize(true);
    const raw = await req.text();
    if (raw.length > 4000) throw new HttpError(413, "Datos demasiado largos.");
    const input = z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().max(40).default(""),
      })
      .parse(parseJson(raw));
    const customer = await createCustomer({
      ...input,
      created: new Date().toISOString(),
    });
    return Response.json({ customer }, { headers });
  } catch (e) {
    return apiError(e);
  }
}

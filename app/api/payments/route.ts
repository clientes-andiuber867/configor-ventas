import { authorize, checkOrigin, HttpError } from "@/features/auth/server";
import { bankConfigured } from "@/features/payments/bank";
import {
  cancelIntent,
  generateIntent,
  getIntent,
  reserveIntent,
  verifyIntent,
} from "@/features/payments/intents";
import { prepareSale } from "@/features/sales/service";
import { apiError } from "@/features/workspace/route-handler";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await authorize();
    const raw = await req.text();
    if (raw.length > 100000)
      throw new HttpError(413, "Venta demasiado grande.");
    const input = JSON.parse(raw);
    if (input.action === "cancel") {
      const id = z.string().uuid().parse(input.id);
      const intent = await getIntent(id);
      if (!intent || intent.cashier !== user.email)
        throw new HttpError(404, "Cobro no encontrado.");
      return Response.json(
        { ...intent, ...(await cancelIntent(intent)) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!bankConfigured())
      throw new HttpError(
        503,
        "Falta configurar Banco Económico en el servidor.",
      );
    const { d } = await prepareSale(input);
    if (d.qr <= 0)
      throw new HttpError(400, "El importe QR debe ser mayor a cero.");
    const intent = await generateIntent(await reserveIntent(d, user.email));
    return Response.json(intent, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(req: Request) {
  try {
    const user = await authorize();
    const id = z.string().uuid().parse(new URL(req.url).searchParams.get("id"));
    const intent = await getIntent(id);
    if (!intent || intent.cashier !== user.email)
      throw new HttpError(404, "Cobro no encontrado.");
    const status =
      intent.qrId || intent.cancelled
        ? await verifyIntent(intent)
        : { paid: false, cancelled: false };
    return Response.json(
      { ...intent, ...status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}

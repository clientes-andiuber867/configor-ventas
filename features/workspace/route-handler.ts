import { bankConfigured } from "@/features/payments/bank";
import {
  authorize,
  checkOrigin,
  digest,
  HttpError,
} from "@/features/auth/server";
import { configureRule, importCatalog } from "@/features/catalog/service";
import { updateRecipient } from "@/features/payments/service";
import { cancelSale, registerSale } from "@/features/sales/service";
import { updateMember } from "@/features/users/service";
import { today } from "@/lib/domain";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { getSettings } from "@/features/workspace/repository";
import { listMembers } from "@/features/users/repository";
import { listProducts } from "@/features/catalog/repository";
import { listSales } from "@/features/sales/repository";
import { cookies } from "next/headers";
import { z } from "zod";
import { apiError } from "@/lib/http/errors";
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const day = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !Number.isNaN(Date.parse(s)) &&
          new Date(s).toISOString().slice(0, 10) === s,
      );
    let from = day.parse(params.get("from") || today()),
      to = day.parse(params.get("to") || today());
    if (from > to) throw new HttpError(400, "El período no es válido.");
    if (cloudEnabled()) {
      const token = (await cookies()).get("configor_session")?.value;
      if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
      const data = await rest<any>("rpc/configor_workspace", "", {
        method: "POST",
        body: JSON.stringify({
          p_token: digest(token),
          p_from: from + "T00:00:00-04:00",
          p_to: to + "T23:59:59.999-04:00",
          p_sales_only: params.get("scope") === "sales",
        }),
      });
      if (!data) throw new HttpError(401, "Inicia sesión para continuar.");
      if (data.payments) data.payments.gatewayReady = bankConfigured();
      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
    }
    const user = await authorize();
    if (user.role !== "admin") from = to = today();
    if (params.get("scope") === "sales")
      return Response.json(
        { sales: await listSales(from, to) },
        { headers: { "Cache-Control": "no-store" } },
      );
    const [settings, products, sales, members] = await Promise.all([
      getSettings(),
      listProducts(),
      listSales(from, to),
      user.role === "admin" ? listMembers() : Promise.resolve([]),
    ]);
    return Response.json(
      {
        user,
        products: products.sort((a, b) => Number(a.plu) - Number(b.plu)),
        sales,
        members,
        rule: settings.rule,
        payments: {
          gatewayReady: bankConfigured(),
          recipient: settings.payments.recipient,
          hasQr: !!settings.payments.qrKey,
          qrVersion: settings.payments.qrKey,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await authorize();
    const raw = await req.text();
    if (raw.length > 2_000_000)
      throw new HttpError(413, "Archivo demasiado grande.");
    const body = JSON.parse(raw);
    if (body.action === "sale")
      return Response.json(await registerSale(body, user));
    if (user.role !== "admin")
      throw new HttpError(403, "Se requiere un administrador.");
    switch (body.action) {
      case "import":
        return Response.json(await importCatalog(body.products));
      case "rule":
        return Response.json(await configureRule(body.rule));
      case "member":
        return Response.json(await updateMember(body.member));
      case "payments":
        return Response.json(await updateRecipient(body.recipient));
      case "void":
        return Response.json(await cancelSale(body.id, body.reason));
      default:
        throw new HttpError(400, "Operación no reconocida.");
    }
  } catch (e) {
    return apiError(e);
  }
}

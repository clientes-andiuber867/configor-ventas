import { authorize, checkOrigin, digest } from "@/features/auth/server";
import { apiError, HttpError } from "@/lib/http/errors";
import { z } from "zod";
import { cashRegister } from "./repository";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { cookies } from "next/headers";
import type { CashState } from "./types";

async function execute(input: Parameters<typeof cashRegister>[1]) {
  if (!cloudEnabled()) return cashRegister(await authorize(), input);
  const token = (await cookies()).get("configor_session")?.value;
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  const result = await rest<(CashState & { error?: string }) | null>(
    "rpc/configor_cash_workspace",
    "",
    {
      method: "POST",
      body: JSON.stringify({
        p_token: digest(token),
        p_action: input.action,
        p_id: input.id || null,
        p_amount: input.amount ?? null,
        p_note: input.note || "",
        p_history: !!input.history,
      }),
    },
  );
  if (!result) throw new HttpError(401, "Inicia sesión para continuar.");
  if (result.error) throw new HttpError(409, result.error);
  return result;
}

const schema = z.object({
  action: z.enum(["open", "close"]),
  id: z.string().uuid(),
  amount: z.number().int().min(0).max(100_000_000),
  note: z.string().trim().max(1000).default(""),
});
export async function GET(req: Request) {
  try {
    return Response.json(
      await execute({
        action: "read",
        history: new URL(req.url).searchParams.get("history") === "1",
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const raw = await req.text();
    if (raw.length > 5000)
      throw new HttpError(413, "Solicitud demasiado grande.");
    const input = schema.parse(JSON.parse(raw));
    return Response.json(
      await execute({ ...input, history: input.action === "close" }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

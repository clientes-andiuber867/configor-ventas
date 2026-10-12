import {
  authorize,
  checkOrigin,
  digest,
  HttpError,
  verifyPassword,
} from "@/features/auth/server";
import {
  getMember,
  removeSession,
  saveSession,
} from "@/lib/supabase/repository";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

export async function GET() {
  try {
    const user = await authorize();
    return Response.json(
      { user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 },
    );
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const b = await req.json();
    if (b.action === "logout") {
      const token = (await cookies()).get("configor_session")?.value;
      await removeSession(digest(token || ""));
      const r = NextResponse.json({ ok: true });
      r.cookies.delete("configor_session");
      return r;
    }
    const input = z
      .object({
        action: z.literal("login"),
        username: z.string().trim().min(1).max(200),
        password: z.string().min(8).max(128),
        role: z.enum(["admin", "cashier"]).optional(),
      })
      .parse(b);
    const username = input.username.toLowerCase();
    const token = randomBytes(32).toString("hex");
    const member = await getMember(username);
    if (
      !member?.active ||
      !(await verifyPassword(input.password, member.passwordHash))
    )
      throw new HttpError(401, "Usuario o contraseña incorrectos.");
    if (input.role && input.role !== member.role)
      throw new HttpError(403, "El usuario no tiene el rol seleccionado.");
    await saveSession({
      tokenHash: digest(token),
      email: username,
      expires: Date.now() + 12 * 60 * 60 * 1000,
    });
    const { passwordHash, ...user } = member;
    const r = NextResponse.json({ user });
    r.cookies.set("configor_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return r;
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Revisa el usuario y la contraseña."
            : e instanceof Error
              ? e.message
              : "No se pudo iniciar sesión.",
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}

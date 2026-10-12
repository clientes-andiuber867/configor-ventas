import type { Member } from "@/lib/domain";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { getMember, getSession } from "@/lib/supabase/repository";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import "server-only";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const derive = promisify(scrypt);
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + ((await derive(password, salt, 64)) as Buffer).toString("hex")
  );
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(":");
  if (!salt || !expected) return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
  const known = Buffer.from(expected, "hex");
  return known.length === actual.length && timingSafeEqual(known, actual);
}
export async function authorize(admin = false) {
  const token = (await cookies()).get("configor_session")?.value;
  if (cloudEnabled()) {
    const user = token
      ? await rest<Member | null>("rpc/configor_auth_user", "", {
          method: "POST",
          body: JSON.stringify({ p_token: digest(token) }),
        })
      : null;
    if (!user) throw new HttpError(401, "Inicia sesión para continuar.");
    if (admin && user.role !== "admin")
      throw new HttpError(403, "Esta acción requiere un administrador.");
    return user;
  }
  const session = token ? await getSession(digest(token)) : undefined;
  const user = session ? await getMember(session.email) : undefined;
  if (!user?.active) throw new HttpError(401, "Inicia sesión para continuar.");
  if (admin && user.role !== "admin")
    throw new HttpError(403, "Esta acción requiere un administrador.");
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== (req.headers.get("host") || new URL(req.url).host)
  )
    throw new HttpError(403, "Origen no autorizado.");
}

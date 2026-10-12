import { hashPassword, HttpError } from "@/features/auth/server";
import { getMember, getSettings, saveMember } from "@/lib/supabase/repository";
import { z } from "zod";
export async function updateMember(input: unknown) {
  const m = z
    .object({
      email: z
        .string()
        .trim()
        .min(3)
        .max(200)
        .regex(/^[a-zA-Z0-9_.@-]+$/),
      name: z.string().trim().min(1).max(80),
      role: z.enum(["admin", "cashier"]),
      active: z.number().int().min(0).max(1),
      password: z.string().max(128).optional(),
    })
    .parse(input);
  m.email = m.email.toLowerCase();
  const [settings, old] = await Promise.all([
    getSettings(),
    getMember(m.email),
  ]);
  if (m.email === settings.owner && (m.role !== "admin" || !m.active))
    throw new HttpError(
      400,
      "El administrador principal debe permanecer activo.",
    );
  if ((!old || m.password) && (!m.password || m.password.length < 8))
    throw new HttpError(400, "Usa una contraseña de al menos 8 caracteres.");
  const { password, ...fields } = m;
  await saveMember(
    {
      ...fields,
      passwordHash: password ? await hashPassword(password) : old!.passwordHash,
    },
    !!password || !m.active || old?.role !== m.role,
  );
  return { ok: true };
}

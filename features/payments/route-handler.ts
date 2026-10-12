import { patchPayments } from "@/features/payments/service";
import { readQr, saveQr } from "@/features/payments/storage";

import { authorize, checkOrigin, HttpError } from "@/features/auth/server";
import { getSettings } from "@/lib/supabase/repository";

export async function GET() {
  try {
    await authorize();
    const s = await getSettings();
    const key = s.payments.qrKey;
    if (!key || !/^[-a-f0-9]+\.(png|jpeg|webp)$/.test(key))
      return new Response("Sin QR", { status: 404 });
    const content = await readQr(key);
    return new Response(content, {
      headers: {
        "Content-Type": "image/" + key.split(".").at(-1),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    await authorize(true);
    checkOrigin(req);
    if (Number(req.headers.get("content-length") || 0) > 2_200_000)
      throw new HttpError(413, "Imagen demasiado grande.");
    const form = await req.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      throw new HttpError(400, "Usa PNG, JPG o WebP de hasta 2 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === "image/png"
        ? bytes[0] === 137 && bytes[1] === 80
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid)
      throw new HttpError(400, "El contenido no es una imagen válida.");
    const key = crypto.randomUUID() + "." + file.type.split("/")[1];
    await saveQr(key, bytes, file.type);
    await patchPayments({ qrKey: key });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return Response.json(
    { error: e instanceof Error ? e.message : "Error" },
    { status: e instanceof HttpError ? e.status : 500 },
  );
}

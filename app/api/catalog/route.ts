import { authorize, checkOrigin, HttpError } from "@/features/auth/server";
import { readCatalog } from "@/features/catalog/import";
import { apiError } from "@/features/workspace/route-handler";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await authorize(true);
    if (
      Number(req.headers.get("content-length") || 0) >
      4 * 1024 * 1024 + 65536
    )
      throw new HttpError(413, "El archivo no puede superar 4 MB.");
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File))
      throw new HttpError(400, "Selecciona un archivo Excel o CSV.");
    return Response.json({ products: await readCatalog(file) });
  } catch (e) {
    return apiError(e);
  }
}

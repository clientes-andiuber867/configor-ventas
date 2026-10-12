import "server-only";

export const cloudEnabled = () => {
  if (process.env.VERCEL && process.env.CONFIGOR_STORAGE !== "supabase")
    throw new Error(
      "Configura CONFIGOR_STORAGE=supabase para desplegar en Vercel.",
    );
  return process.env.CONFIGOR_STORAGE === "supabase";
};
export async function cloudFetch(resource: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error("Falta configurar la conexiÃ³n con Supabase.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  // Legacy service-role JWTs additionally require the bearer header.
  if (!key.startsWith("sb_secret_"))
    headers.set("Authorization", "Bearer " + key);
  const response = await fetch(url + resource, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error(
      "Supabase request failed",
      response.status,
      resource.split("?")[0],
    );
    throw new Error(
      "No se pudo completar la operaciÃ³n en Supabase. Intenta nuevamente.",
    );
  }
  return response;
}
export async function rest<T>(
  table: string,
  query = "",
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const r = await cloudFetch("/rest/v1/" + table + (query ? "?" + query : ""), {
    ...init,
    headers,
  });
  if (r.status === 204 || r.headers.get("content-length") === "0")
    return undefined as T;
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

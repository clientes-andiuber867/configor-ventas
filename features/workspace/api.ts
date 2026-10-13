export async function api(body?: any, query = "") {
  const r = await fetch(
    "/api/data" + query,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const d: any = await r.json();
  if (!r.ok) throw Error(d.error || "No se pudo conectar.");
  return d;
}

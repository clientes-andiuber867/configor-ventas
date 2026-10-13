export function blocked(until: number) {
  const retryAfter = Math.max(1, Math.ceil((until - Date.now()) / 1000));
  return Response.json(
    {
      error: "Acceso bloqueado temporalmente por 3 intentos incorrectos.",
      retryAfter,
      blockedUntil: until,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
export function busy() {
  return Response.json(
    { error: "El acceso está ocupado. Intenta nuevamente en unos segundos." },
    {
      status: 503,
      headers: { "Retry-After": "2", "Cache-Control": "no-store" },
    },
  );
}
export function incorrect(remaining: number) {
  return Response.json(
    {
      error: `Usuario o contraseña incorrectos. ${remaining === 1 ? "Te queda 1 intento" : `Te quedan ${remaining} intentos`} antes del bloqueo.`,
      attemptsRemaining: remaining,
    },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function apiError(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof z.ZodError
          ? "Datos inválidos. Revisa los campos."
          : e instanceof Error
            ? e.message
            : "No se pudo completar la operación.",
    },
    {
      status:
        e instanceof HttpError ? e.status : e instanceof z.ZodError ? 400 : 500,
    },
  );
}

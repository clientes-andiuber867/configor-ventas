import "server-only";

export const bankConfigured = () =>
  ["BANECO_AES_KEY", "BANECO_USER", "BANECO_PASSWORD", "BANECO_ACCOUNT"].every(
    (key) => !!process.env[key],
  );
let cached: { token: string; expires: number } | undefined;
async function request(
  endpoint: string,
  body?: unknown,
  token?: string,
  method?: string,
) {
  if (!bankConfigured())
    throw Error("Falta configurar la pasarela Banco Económico en el servidor.");
  const base =
    process.env.BANECO_BASE_URL || "https://apimkt.baneco.com.bo/ApiGateway";
  const response = await fetch(base + endpoint, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (response.status === 401) cached = undefined;
    throw Error(
      "El banco no respondió correctamente. Intenta consultar nuevamente.",
    );
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text.trim();
  }
}
async function encrypt(text: string) {
  const result = await request(
    "/api/authentication/encrypt?" +
      new URLSearchParams({ text, aesKey: process.env.BANECO_AES_KEY! }),
  );
  if (typeof result !== "string" || !result)
    throw Error("No se pudo autenticar con el banco.");
  return result;
}
async function token() {
  if (cached && cached.expires > Date.now()) return cached.token;
  const result = await request("/api/authentication/authenticate", {
    userName: process.env.BANECO_USER,
    password: await encrypt(process.env.BANECO_PASSWORD!),
  });
  if (result.responseCode !== 0 || !result.token)
    throw Error("No se pudo autenticar con Banco Económico.");
  cached = { token: result.token, expires: Date.now() + 19 * 60000 };
  return cached.token;
}
export async function generateQR(
  amount: number,
  reference: string,
  transactionId = reference,
) {
  const bearer = await token();
  const dueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const result = await request(
    "/api/qrsimple/generateQR",
    {
      transactionId,
      accountCredit: await encrypt(process.env.BANECO_ACCOUNT!),
      currency: "BOB",
      amount: amount / 100,
      description: reference,
      dueDate,
      singleUse: true,
      modifyAmount: false,
    },
    bearer,
  );
  if (
    result.responseCode !== 0 ||
    !result.qrId ||
    typeof result.qrImage !== "string" ||
    !result.qrImage
  )
    throw Error(
      "El banco no pudo generar el QR. Reintenta con la misma venta.",
    );
  return { qrId: String(result.qrId), qrImage: result.qrImage, dueDate };
}
export async function checkQR(qrId: string) {
  const result = await request(
    "/api/qrsimple/v2/statusQR/" + encodeURIComponent(qrId),
    undefined,
    await token(),
  );
  if (result.responseCode !== 0)
    throw Error("No se pudo consultar el pago. Reintentando la verificación.");
  return {
    paid: result.statusQrCode === 1,
    cancelled: result.statusQrCode === 9,
    payment: result.payment?.[0],
  };
}

// API Market manual, section 6.3: DELETE with qrId in the JSON body.
export async function cancelQR(qrId: string) {
  const result = await request(
    "/api/qrsimple/cancelQR",
    { qrId },
    await token(),
    "DELETE",
  );
  if (result.responseCode !== 0)
    throw Error(
      "El banco no pudo anular el QR. Consulta nuevamente su estado.",
    );
}

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { rest } from "@/lib/supabase/client";
import { blocked, busy, incorrect } from "./responses";

type Claim = {
  status: "allowed" | "blocked" | "busy" | "expired";
  blockedUntil: number;
  attemptsRemaining: number;
};
export async function withCloudThrottle(
  username: string,
  authenticate: () => Promise<Response>,
): Promise<Response> {
  const p_account = createHash("sha256")
    .update(username.trim().toLowerCase())
    .digest("hex");
  const p_lease = randomUUID();
  const call = (name: string, values: object) =>
    rest<Claim>("rpc/configor_login_" + name, "", {
      method: "POST",
      body: JSON.stringify({ p_account, p_lease, ...values }),
    });
  const claim = await call("claim", {});
  if (claim.status === "blocked") return blocked(claim.blockedUntil);
  if (claim.status !== "allowed") return busy();
  let response: Response;
  try {
    response = await authenticate();
  } catch (error) {
    // Release on role selection / transport errors. A crashed process's lease
    // expires automatically; an old response can never reset a newer attempt.
    await call("complete", { p_outcome: "cancel" }).catch(() => {});
    throw error;
  }
  const result = await call("complete", {
    p_outcome: response.ok
      ? "success"
      : response.status === 401
        ? "failure"
        : "cancel",
  });
  if (result.status === "expired" || result.status === "busy") return busy();
  if (result.status === "blocked") return blocked(result.blockedUntil);
  return response.status === 401
    ? incorrect(result.attemptsRemaining)
    : response;
}

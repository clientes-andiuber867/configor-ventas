import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { readStore, updateStore } from "@/lib/local-store";
import { eq, write } from "@/lib/supabase/queries";
type Session = { tokenHash: string; email: string; expires: number };
const sessionMaintenance = globalThis as typeof globalThis & {
  configorSessionPruneAfter?: number;
};
export async function getSession(
  tokenHash: string,
): Promise<Session | undefined> {
  if (!cloudEnabled())
    return (await readStore()).sessions.find(
      (s) => s.tokenHash === tokenHash && s.expires > Date.now(),
    );
  return (
    await rest<Session[]>(
      "configor_sessions",
      "tokenHash=" + eq(tokenHash) + "&expires=gt." + Date.now() + "&limit=1",
    )
  )[0];
}

export async function saveSession(session: Session) {
  if (!cloudEnabled())
    return updateStore((s) => {
      s.sessions = s.sessions.filter((x) => x.expires > Date.now());
      s.sessions.push(session);
    });
  // Expired sessions are already rejected by authentication. Prune on demand
  // once per hour instead of issuing a database DELETE for every login.
  const now = Date.now();
  if (now >= (sessionMaintenance.configorSessionPruneAfter || 0)) {
    sessionMaintenance.configorSessionPruneAfter = now + 60 * 60 * 1000;
    try {
      await rest("configor_sessions", "expires=lt." + now, {
        method: "DELETE",
      });
    } catch (error) {
      sessionMaintenance.configorSessionPruneAfter = 0;
      throw error;
    }
  }
  await rest("configor_sessions", "", write(session));
}

export async function removeSession(tokenHash: string) {
  if (!cloudEnabled())
    return updateStore((s) => {
      s.sessions = s.sessions.filter((x) => x.tokenHash !== tokenHash);
    });
  await rest("configor_sessions", "tokenHash=" + eq(tokenHash), {
    method: "DELETE",
  });
}

import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson } from "@/lib/atomic-file";

type Attempt = { failures: number; level: number; blockedUntil: number };
const directory = path.resolve(
  /* turbopackIgnore: true */ process.env.CONFIGOR_DATA_DIR ||
    path.join(process.cwd(), "data"),
);
const file = path.join(directory, "login-attempts.json");
const globals = globalThis as typeof globalThis & {
  configorLoginQueue?: Promise<unknown>;
  configorLoginPending?: number;
};

import { blocked, busy, incorrect } from "./responses";

// Persistent protection for this local, single-process installation. Serialize
// the entire verification so concurrent attempts cannot pass the same counter.
export function withLocalThrottle(
  username: string,
  authenticate: () => Promise<Response>,
): Promise<Response> {
  // Bound queued password work on small servers; never weaken scrypt to save CPU.
  if ((globals.configorLoginPending || 0) >= 8) {
    return Promise.resolve(busy());
  }
  globals.configorLoginPending = (globals.configorLoginPending || 0) + 1;
  const task = (globals.configorLoginQueue || Promise.resolve()).then(
    async () => {
      let records: Record<string, Attempt>;
      try {
        records = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        records = {};
      }
      const key = createHash("sha256")
        .update(username.trim().toLowerCase())
        .digest("hex");
      const state = records[key] || { failures: 0, level: 0, blockedUntil: 0 };
      if (state.blockedUntil > Date.now()) return blocked(state.blockedUntil);

      const response = await authenticate();
      if (response.ok) {
        if (!records[key]) return response; // Nothing to reset: no mkdir, rewrite or rename.
        delete records[key];
      } else if (response.status === 401) {
        state.failures++;
        if (state.failures >= 3) {
          // 5m, 15m, 30m, 1h, 2h, 4h, 8h, 16h; cap at 24h.
          const minutes =
            state.level === 0
              ? 5
              : Math.min(1440, 15 * 2 ** Math.min(state.level - 1, 7));
          state.level = Math.min(state.level + 1, 9);
          state.failures = 0;
          state.blockedUntil = Date.now() + minutes * 60_000;
        }
        records[key] = state;
      } else {
        return response; // Role selection and infrastructure errors are not password failures.
      }
      await mkdir(directory, { recursive: true });
      await atomicWriteJson(file, records);
      if (state.blockedUntil > Date.now() && !response.ok)
        return blocked(state.blockedUntil);
      if (!response.ok) {
        const remaining = 3 - state.failures;
        return incorrect(remaining);
      }
      return response;
    },
  );
  const settled = task.finally(() => {
    globals.configorLoginPending!--;
  });
  globals.configorLoginQueue = settled.catch(() => {});
  return settled;
}

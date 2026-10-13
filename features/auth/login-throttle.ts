import "server-only";
import { cloudEnabled } from "@/lib/supabase/client";
import { withCloudThrottle } from "./throttle/supabase";
import { withLocalThrottle } from "./throttle/local";

export function withLoginThrottle(
  username: string,
  authenticate: () => Promise<Response>,
) {
  return cloudEnabled()
    ? withCloudThrottle(username, authenticate)
    : withLocalThrottle(username, authenticate);
}

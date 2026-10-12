import { dataDirectory } from "@/lib/local-store";
import { cloudEnabled, cloudFetch } from "@/lib/supabase/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import "server-only";
const bucket = "configor-payments";
export async function readQr(key: string) {
  if (!cloudEnabled())
    return readFile(path.join(dataDirectory, "uploads", key));
  return Buffer.from(
    await (
      await cloudFetch("/storage/v1/object/authenticated/" + bucket + "/" + key)
    ).arrayBuffer(),
  );
}
export async function saveQr(key: string, bytes: Uint8Array, mime: string) {
  if (!cloudEnabled()) {
    await mkdir(path.join(dataDirectory, "uploads"), { recursive: true });
    await writeFile(path.join(dataDirectory, "uploads", key), bytes);
    return;
  }
  await cloudFetch("/storage/v1/object/" + bucket + "/" + key, {
    method: "POST",
    headers: { "Content-Type": mime },
    body: Buffer.from(bytes),
  });
}

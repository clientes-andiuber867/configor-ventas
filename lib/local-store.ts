import { mkdir, readFile } from "node:fs/promises";
import { atomicWriteJson } from "./atomic-file";
import path from "node:path";
import type { Member, Product, Sale, BarcodeRule } from "./domain";
import { defaultRule } from "./domain";
export type LocalMember = Member & { passwordHash: string };
export type Store = {
  version: 1;
  owner: string;
  members: LocalMember[];
  products: Product[];
  sales: Sale[];
  rule: BarcodeRule;
  payments: { recipient: string; qrKey: string };
  sessions: { tokenHash: string; email: string; expires: number }[];
};
export const dataDirectory = path.resolve(
  /* turbopackIgnore: true */ process.env.CONFIGOR_DATA_DIR ||
    path.join(process.cwd(), "data"),
);
const file = path.join(dataDirectory, "configor.json");
const globals = globalThis as typeof globalThis & {
  configorWrite?: Promise<unknown>;
};
export function emptyStore(): Store {
  return {
    version: 1,
    owner: "",
    members: [],
    products: [],
    sales: [],
    rule: { ...defaultRule },
    payments: { recipient: "", qrKey: "" },
    sessions: [],
  };
}
export async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e: any) {
    if (e.code === "ENOENT") return emptyStore();
    throw e;
  }
}
// One local Node process. Serialize read-modify-write and replace the file atomically.
export async function updateStore<T>(
  change: (state: Store) => T | Promise<T>,
): Promise<T> {
  const task = (globals.configorWrite || Promise.resolve()).then(async () => {
    const state = await readStore();
    const result = await change(state);
    await mkdir(dataDirectory, { recursive: true });
    await atomicWriteJson(file, state);
    return result;
  });
  globals.configorWrite = task.catch(() => {});
  return task;
}
export const publicMember = ({ passwordHash, ...member }: LocalMember) =>
  member;

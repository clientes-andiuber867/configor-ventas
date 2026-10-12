import { writeFile, rename, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

// Windows can briefly deny replacement while another reader has the file open.
// Always retain the committed file until the replacement succeeds.
export async function atomicWriteJson(
  file: string,
  value: unknown,
  replace: typeof rename = rename,
) {
  const temp = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try {
        await replace(temp, file);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!["EPERM", "EACCES", "EBUSY"].includes(code || "") || attempt >= 7)
          throw error;
        await delay(Math.min(40 * 2 ** attempt, 400));
      }
    }
  } catch (error) {
    throw new Error(
      "No se pudieron guardar los cambios. El archivo de datos está bloqueado o no se puede escribir. Intenta guardar nuevamente.",
      { cause: error },
    );
  } finally {
    await unlink(temp).catch(() => {});
  }
}

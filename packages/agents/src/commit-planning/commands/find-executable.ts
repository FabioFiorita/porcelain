import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export async function findExecutable(
  name: string,
): Promise<string | undefined> {
  for (const directory of (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)) {
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      if ((await stat(path)).isFile()) return path;
    } catch {}
  }
  return undefined;
}

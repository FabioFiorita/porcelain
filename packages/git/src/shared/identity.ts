import { stat } from 'node:fs/promises';
import { UnsupportedFilesystemIdentityError } from './errors/unsupported-filesystem-identity-error.ts';

export async function identity(path: string): Promise<string> {
  const info = await stat(path, { bigint: true });
  if (info.birthtimeNs === 0n) throw new UnsupportedFilesystemIdentityError();
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}

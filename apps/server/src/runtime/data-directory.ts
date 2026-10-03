import { mkdirSync, realpathSync, statSync } from 'node:fs';
import { DataDirectoryInsecureError } from './errors/data-directory-insecure-error.ts';

export function prepareDataDirectory(dataDirectory: string): string {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const directory = realpathSync(dataDirectory);
  const stats = statSync(directory);
  const uid = process.getuid?.();
  if (uid !== undefined && stats.uid !== uid)
    throw new DataDirectoryInsecureError(
      directory,
      'it belongs to a different user',
    );
  const mode = stats.mode & 0o777;
  if ((mode & 0o077) !== 0)
    throw new DataDirectoryInsecureError(
      directory,
      `its mode is ${mode.toString(8).padStart(3, '0')}, which lets other users reach the owner socket`,
    );
  return directory;
}

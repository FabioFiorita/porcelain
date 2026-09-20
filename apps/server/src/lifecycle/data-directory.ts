import { mkdirSync, realpathSync, statSync } from 'node:fs';
import { DataDirectoryInsecureError } from './errors/data-directory-insecure-error.ts';

/**
 * Resolve the data directory and prove it is private before anything is bound
 * inside it.  Owner operations are authenticated by file permissions, and a
 * Unix socket's own mode is not a portable boundary — every platform checks
 * search permission on the containing directory, so that directory is the
 * boundary.  `mkdir` only applies a mode to a directory it creates, so an
 * inherited or hand-made directory can still be group- or world-readable.
 */
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

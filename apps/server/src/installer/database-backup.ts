import { Effect, FileSystem, Path } from 'effect';
import { randomUUID } from 'node:crypto';
import { databaseFiles } from '@porcelain/storage';
import { exists } from './json-file.ts';

export function backupLocation(
  root: string,
  now: string,
  label: string,
  pathApi: Path.Path,
): string {
  const stamp = now.replaceAll(':', '-');
  return pathApi.join(root, `${stamp}-${label}-${randomUUID()}`);
}

export const backupDatabase = Effect.fn('Installer.backupDatabase')(function* (
  dataDirectory: string,
  destination: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  yield* fs.makeDirectory(destination, { recursive: true, mode: 0o700 });
  for (const file of databaseFiles) {
    const source = pathApi.join(dataDirectory, file);
    if (yield* exists(source))
      yield* fs.copyFile(source, pathApi.join(destination, file));
  }
});

export const restoreDatabase = Effect.fn('Installer.restoreDatabase')(
  function* (dataDirectory: string, backup: string) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 });
    for (const file of databaseFiles) {
      yield* fs.remove(pathApi.join(dataDirectory, file), { force: true });
      const source = pathApi.join(backup, file);
      if (yield* exists(source))
        yield* fs.copyFile(source, pathApi.join(dataDirectory, file));
    }
  },
);

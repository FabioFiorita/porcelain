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
  const staging = `${destination}.${randomUUID()}.partial`;
  yield* Effect.gen(function* () {
    yield* fs.makeDirectory(staging, { recursive: true, mode: 0o700 });
    for (const file of databaseFiles) {
      const source = pathApi.join(dataDirectory, file);
      if (yield* exists(source))
        yield* fs.copyFile(source, pathApi.join(staging, file));
    }
    yield* fs.rename(staging, destination);
  }).pipe(
    Effect.ensuring(
      fs.remove(staging, { recursive: true, force: true }).pipe(Effect.orDie),
    ),
  );
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

export const pruneDatabaseBackups = Effect.fn('Installer.pruneDatabaseBackups')(
  function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    if (!(yield* exists(root))) return;
    const directories: string[] = [];
    for (const entry of yield* fs.readDirectory(root)) {
      if (entry.endsWith('.partial')) continue;
      if ((yield* fs.stat(pathApi.join(root, entry))).type === 'Directory')
        directories.push(entry);
    }
    for (const entry of directories.sort().reverse().slice(3))
      yield* fs.remove(pathApi.join(root, entry), { recursive: true });
  },
);

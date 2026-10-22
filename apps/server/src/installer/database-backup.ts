import { Effect, FileSystem, Path } from 'effect';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { UpdateRecoveryError } from './errors/update-recovery-error.ts';
import { failureDetail } from './failure-detail.ts';
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
    const prepared = yield* Effect.gen(function* () {
      const entries = yield* fs.readDirectory(backup);
      const files = databaseFiles.filter((file) => entries.includes(file));
      if (files.length > 0 && !files.includes('inventory.sqlite'))
        return yield* Effect.fail(
          new UpdateRecoveryError({
            detail: 'The backup contains sidecars without its database.',
          }),
        );
      yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 });
      const staging = yield* fs.makeTempDirectoryScoped({
        directory: dataDirectory,
        prefix: '.restore-',
      });
      for (const file of files)
        yield* fs.copyFile(
          pathApi.join(backup, file),
          pathApi.join(staging, file),
        );
      if (files.includes('inventory.sqlite')) {
        yield* Effect.try(() => {
          const database = new DatabaseSync(
            pathApi.join(staging, 'inventory.sqlite'),
            { readOnly: true },
          );
          try {
            const result = database.prepare('PRAGMA quick_check').all();
            if (result.length !== 1 || result[0]?.quick_check !== 'ok')
              throw new Error(
                'The backup database failed SQLite integrity validation.',
              );
          } finally {
            database.close();
          }
        });
      }
      return { staging, files };
    }).pipe(
      Effect.mapError(
        (error) =>
          new UpdateRecoveryError({
            detail: `Could not prepare database backup "${backup}" for restoration. Check that the backup exists, is readable and contains a valid SQLite database, then retry recovery. ${error instanceof UpdateRecoveryError ? error.detail : failureDetail(error)}`,
          }),
      ),
    );
    for (const file of databaseFiles) {
      const destination = pathApi.join(dataDirectory, file);
      if (prepared.files.includes(file))
        yield* fs.rename(pathApi.join(prepared.staging, file), destination);
      else yield* fs.remove(destination, { force: true });
    }
  },
  Effect.scoped,
);

export const pruneDatabaseBackups = Effect.fn('Installer.pruneDatabaseBackups')(
  function* (root: string) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    if (!(yield* exists(root))) return;
    const directories: string[] = [];
    for (const entry of yield* fs.readDirectory(root)) {
      if (entry.endsWith('.partial')) {
        yield* fs.remove(pathApi.join(root, entry), {
          recursive: true,
          force: true,
        });
        continue;
      }
      if ((yield* fs.stat(pathApi.join(root, entry))).type === 'Directory')
        directories.push(entry);
    }
    for (const entry of directories.sort().reverse().slice(3))
      yield* fs.remove(pathApi.join(root, entry), { recursive: true });
  },
);

export const pruneDatabaseBackupsAfterUpdate = Effect.fn(
  'Installer.pruneDatabaseBackupsAfterUpdate',
)((root: string) =>
  pruneDatabaseBackups(root).pipe(
    Effect.catch((error) =>
      Effect.logWarning(
        'The service update succeeded, but old database backups could not be removed',
        error,
      ),
    ),
  ),
);

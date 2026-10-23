import { ByteSize, Effect, FileSystem, Path } from 'effect';
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
        const databasePath = pathApi.join(staging, 'inventory.sqlite');
        const file = yield* fs.open(databasePath);
        const header = new Uint8Array(18);
        const bytesRead = yield* file.read(header);
        const encodedPageSize = new DataView(header.buffer).getUint16(16);
        const pageSize = encodedPageSize === 1 ? 65536 : encodedPageSize;
        if (
          bytesRead !== header.length ||
          new TextDecoder().decode(header.subarray(0, 16)) !==
            'SQLite format 3\0' ||
          pageSize < 512 ||
          (pageSize & (pageSize - 1)) !== 0 ||
          (yield* file.stat).size < ByteSize.bytes(pageSize)
        )
          return yield* Effect.fail(
            new UpdateRecoveryError({
              detail:
                'The backup database must have a SQLite header and at least one complete page.',
            }),
          );
        yield* Effect.try(() => {
          const database = new DatabaseSync(databasePath, { readOnly: true });
          try {
            const result = database.prepare('PRAGMA quick_check').all();
            if (result.length !== 1 || result[0]?.quick_check !== 'ok')
              throw new Error(
                'The backup database failed SQLite integrity validation.',
              );
            const migrationTable = database.prepare(
              "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?",
            );
            const migrationQueries = {
              porcelain_migrations:
                'SELECT migration_id FROM porcelain_migrations LIMIT 1',
              __drizzle_migrations:
                'SELECT hash FROM __drizzle_migrations LIMIT 1',
            };
            if (
              !Object.entries(migrationQueries).some(
                ([table, query]) =>
                  migrationTable.get(table) !== undefined &&
                  database.prepare(query).get() !== undefined,
              )
            )
              throw new Error(
                'The backup database must contain at least one applied Porcelain migration.',
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
            detail: `Could not prepare database backup "${backup}" for restoration. Check that the backup exists, is readable and contains a valid Porcelain SQLite database with an applied migration, then retry recovery. ${error instanceof UpdateRecoveryError ? error.detail : failureDetail(error)}`,
          }),
      ),
    );
    yield* Effect.gen(function* () {
      const previous = yield* fs.makeTempDirectory({
        directory: dataDirectory,
        prefix: '.restore-previous-',
      });
      const displaced: string[] = [];
      const promoted: string[] = [];
      yield* Effect.gen(function* () {
        for (const file of databaseFiles) {
          const current = pathApi.join(dataDirectory, file);
          if (yield* exists(current)) {
            yield* fs.rename(current, pathApi.join(previous, file));
            displaced.push(file);
          }
        }
        for (const file of prepared.files) {
          yield* fs.rename(
            pathApi.join(prepared.staging, file),
            pathApi.join(dataDirectory, file),
          );
          promoted.push(file);
        }
      }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.gen(function* () {
              for (const file of promoted)
                if (!displaced.includes(file))
                  yield* fs.remove(pathApi.join(dataDirectory, file));
              for (const file of displaced)
                yield* fs.rename(
                  pathApi.join(previous, file),
                  pathApi.join(dataDirectory, file),
                );
            }).pipe(
              Effect.mapError(
                (rollbackError) =>
                  new UpdateRecoveryError({
                    detail: `Could not promote database backup "${backup}" or restore the displaced files. Original database files remain in "${previous}"; retain that directory and the backup for recovery. ${failureDetail(error)} ${failureDetail(rollbackError)}`,
                  }),
              ),
            );
            yield* fs.remove(previous, { recursive: true });
            return yield* Effect.fail(
              new UpdateRecoveryError({
                detail: `Could not promote database backup "${backup}". The current database files were restored; retry recovery after resolving the filesystem error. ${failureDetail(error)}`,
              }),
            );
          }),
        ),
      );
      yield* fs.remove(previous, { recursive: true });
    }).pipe(Effect.uninterruptible);
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

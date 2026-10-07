import { Effect, FileSystem, Layer, Path, String } from 'effect';
import { SqlClient } from 'effect/sql';
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node';
import { InvalidDataDirectoryError } from '../errors/invalid-data-directory-error.ts';
import { DATABASE_FILE } from './database-files.ts';
import { createEnvironmentIdentity } from './environment-identity.ts';
import { nativeMigrations, upgradeLegacyDatabase } from './migrate.ts';

export function databaseLayer(
  dataDirectory: string,
  options: { worktreeIdLength: number; busyTimeoutMs: number },
) {
  const client = Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      if (!path.isAbsolute(dataDirectory))
        return yield* Effect.die(new InvalidDataDirectoryError());
      yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 });
      const filename = path.join(dataDirectory, DATABASE_FILE);
      yield* upgradeLegacyDatabase(filename, options);
      return SqliteClient.layer({
        filename,
        busyTimeout: options.busyTimeoutMs,
        transformResultNames: String.snakeToCamel,
        transformQueryNames: String.camelToSnake,
      });
    }).pipe(Effect.orDie),
  ).pipe(Layer.orDie);
  const migration = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`PRAGMA foreign_keys = ON`;
    yield* SqliteMigrator.run({
      table: 'porcelain_migrations',
      loader: nativeMigrations,
    });
    yield* createEnvironmentIdentity();
  }).pipe(Effect.orDie);
  return Layer.effectDiscard(migration).pipe(Layer.provideMerge(client));
}

import {
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  Schema,
  String,
} from 'effect';
import { SqlClient, SqlSchema, Migrator } from 'effect/sql';
import { SqliteClient, SqliteMigrator } from '@effect/sql-sqlite-node';
import { InvalidDataDirectoryError } from '../errors/invalid-data-directory-error.ts';
import { UnsupportedDatabaseVersionError } from '../errors/unsupported-database-version-error.ts';
import { DATABASE_FILE } from './database-files.ts';
import { createEnvironmentIdentity } from './environment-identity.ts';
import { readLegacyMigrations, upgradeLegacyDatabase } from './migrate.ts';

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
  );
  const migration = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`PRAGMA foreign_keys = ON`;
    const shipped = yield* readLegacyMigrations();
    const loader = Migrator.fromRecord({
      '001_adopt_legacy_schema': Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const hashes = yield* SqlSchema.findAll({
          Request: Schema.Void,
          Result: Schema.Struct({ hash: Schema.String }),
          execute: () =>
            sql`SELECT hash FROM __drizzle_migrations ORDER BY rowid`,
        })(undefined);
        if (
          hashes.length !== shipped.length ||
          hashes.some((row, index) => row.hash !== shipped[index]?.hash)
        )
          return yield* Effect.die(
            new UnsupportedDatabaseVersionError(
              'incompatible migration history',
            ),
          );
      }),
    });
    const nativeTable = yield* SqlSchema.findOneOption({
      Request: Schema.Void,
      Result: Schema.Struct({ name: Schema.String }),
      execute: () =>
        sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'porcelain_migrations'`,
    })(undefined);
    if (Option.isSome(nativeTable)) {
      const history = yield* SqlSchema.findAll({
        Request: Schema.Void,
        Result: Schema.Struct({ migrationId: Schema.Int, name: Schema.String }),
        execute: () =>
          sql`SELECT migration_id, name FROM porcelain_migrations ORDER BY migration_id`,
      })(undefined);
      const available = yield* loader;
      if (
        history.some(
          (entry, index) =>
            entry.migrationId !== available[index]?.[0] ||
            entry.name !== available[index]?.[1],
        )
      )
        return yield* Effect.die(
          new UnsupportedDatabaseVersionError(
            'incompatible native migration history',
          ),
        );
    }
    yield* SqliteMigrator.run({ table: 'porcelain_migrations', loader });
    yield* createEnvironmentIdentity();
  }).pipe(Effect.orDie);
  return Layer.effectDiscard(migration).pipe(Layer.provideMerge(client));
}

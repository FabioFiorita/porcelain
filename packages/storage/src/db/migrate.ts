import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Effect, FileSystem, Schema } from 'effect';
import { Migrator } from 'effect/sql';
import { UnsupportedDatabaseVersionError } from '../errors/unsupported-database-version-error.ts';
import { worktreeIdV1 } from './worktree-id-v1.ts';

const journalSchema = Schema.fromJsonString(
  Schema.Struct({
    entries: Schema.Array(
      Schema.Struct({
        idx: Schema.Int,
        when: Schema.Number,
        tag: Schema.String,
      }),
    ),
  }),
);
const hashRowsSchema = Schema.Array(Schema.Struct({ hash: Schema.String }));
const tableRowsSchema = Schema.Array(Schema.Struct({ name: Schema.String }));
const versionRowsSchema = Schema.Array(
  Schema.Struct({ user_version: Schema.Int }),
);

const nativeColumnSchema = Schema.Array(
  Schema.Struct({
    name: Schema.String,
    notnull: Schema.Int,
    dflt_value: Schema.NullOr(Schema.String),
  }),
);

const nativeHistorySchema = Schema.Array(
  Schema.Struct({ migration_id: Schema.Int, name: Schema.String }),
);

export const nativeMigrations = Migrator.fromRecord({
  '001_adopt_legacy_schema': Effect.void,
});

export const readLegacyMigrations = Effect.fn('Storage.readLegacyMigrations')(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const directory = new URL('../../drizzle/', import.meta.url);
    const journal = yield* fs.readFileString(
      fileURLToPath(new URL('meta/_journal.json', directory)),
    );
    const { entries } = yield* Schema.decodeEffect(journalSchema)(journal);
    return yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function* () {
        const source = yield* fs.readFileString(
          fileURLToPath(new URL(`${entry.tag}.sql`, directory)),
        );
        return {
          id: entry.idx,
          tag: entry.tag,
          timestamp: entry.when,
          hash: createHash('sha256').update(source).digest('hex'),
          sql: source.split('--> statement-breakpoint'),
        };
      }),
    );
  },
);

type LegacyMigration = Effect.Success<
  ReturnType<typeof readLegacyMigrations>
>[number];

function appliedHashes(database: DatabaseSync): readonly string[] {
  return Schema.decodeUnknownSync(hashRowsSchema)(
    database
      .prepare('SELECT hash FROM __drizzle_migrations ORDER BY rowid')
      .all(),
  ).map((entry) => entry.hash);
}

function assertNativeMigrationHistory(
  database: DatabaseSync,
  available: readonly Migrator.ResolvedMigration[],
) {
  const objects = database
    .prepare(
      "SELECT type FROM sqlite_master WHERE name = 'porcelain_migrations'",
    )
    .all();
  if (objects.length === 0) return;
  try {
    if (objects.length !== 1 || objects[0]?.type !== 'table')
      throw new UnsupportedDatabaseVersionError({
        version: 'invalid native migration table',
      });
    const columns = Schema.decodeUnknownSync(nativeColumnSchema)(
      database.prepare('PRAGMA table_info(porcelain_migrations)').all(),
    );
    const expectedColumns = ['migration_id', 'name', 'created_at'];
    if (
      columns.length !== expectedColumns.length ||
      expectedColumns.some(
        (name) => !columns.some((column) => column.name === name),
      )
    )
      throw new UnsupportedDatabaseVersionError({
        version: 'invalid native migration table',
      });
    const createdAt = columns.find((column) => column.name === 'created_at');
    if (
      createdAt?.notnull === 1 &&
      (createdAt.dflt_value === null ||
        database.prepare(`SELECT ${createdAt.dflt_value} AS value`).get()
          ?.value === null)
    )
      throw new UnsupportedDatabaseVersionError({
        version: 'invalid native migration timestamp',
      });
    const history = Schema.decodeUnknownSync(nativeHistorySchema)(
      database
        .prepare(
          'SELECT migration_id, name FROM porcelain_migrations ORDER BY migration_id',
        )
        .all(),
    );
    if (
      history.some(
        (entry, index) =>
          entry.migration_id !== available[index]?.[0] ||
          entry.name !== available[index]?.[1],
      )
    )
      throw new UnsupportedDatabaseVersionError({
        version: 'incompatible native migration history',
      });
  } catch {
    throw new UnsupportedDatabaseVersionError({
      version: 'incompatible native migration history',
    });
  }
}

function assertMigrationHistory(
  database: DatabaseSync,
  shipped: readonly LegacyMigration[],
) {
  const tables = Schema.decodeUnknownSync(tableRowsSchema)(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all(),
  );
  if (!tables.some((table) => table.name === '__drizzle_migrations')) {
    const version = Schema.decodeUnknownSync(versionRowsSchema)(
      database.prepare('PRAGMA user_version').all(),
    );
    if (tables.length > 0 || version[0]?.user_version !== 0)
      throw new UnsupportedDatabaseVersionError({
        version: 'untracked schema',
      });
    return;
  }
  const applied = appliedHashes(database);
  if (
    (applied.length === 0 && tables.length > 1) ||
    applied.some((hash, index) => hash !== shipped[index]?.hash)
  )
    throw new UnsupportedDatabaseVersionError({
      version: 'incompatible migration history',
    });
}

export const upgradeLegacyDatabase = Effect.fn('Storage.upgradeLegacyDatabase')(
  function* (
    filename: string,
    options: { worktreeIdLength: number; busyTimeoutMs: number },
  ) {
    const shipped = yield* readLegacyMigrations();
    const available = yield* nativeMigrations;
    yield* Effect.acquireUseRelease(
      Effect.sync(() => new DatabaseSync(filename)),
      (database) =>
        Effect.sync(() => {
          assertNativeMigrationHistory(database, available);
          assertMigrationHistory(database, shipped);
          database.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs}`);
          database.exec('PRAGMA journal_mode = WAL');
          database.function(
            'porcelain_worktree_id',
            { deterministic: true },
            (projectId, metadataIdentity) =>
              typeof projectId === 'string' &&
              typeof metadataIdentity === 'string'
                ? worktreeIdV1(
                    projectId,
                    metadataIdentity,
                    options.worktreeIdLength,
                  )
                : null,
          );
          database.exec('PRAGMA foreign_keys = OFF');
          database.exec('BEGIN IMMEDIATE');
          try {
            database.exec(
              'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
            );
            const record = database.prepare(
              'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
            );
            for (const migration of shipped.slice(
              appliedHashes(database).length,
            )) {
              for (const statement of migration.sql) database.exec(statement);
              record.run(migration.hash, migration.timestamp);
            }
            if (database.prepare('PRAGMA foreign_key_check').all().length > 0)
              throw new UnsupportedDatabaseVersionError({
                version: 'orphaned rows',
              });
            database.exec('COMMIT');
          } catch (error) {
            database.exec('ROLLBACK');
            throw error;
          }
        }),
      (database) => Effect.sync(() => database.close()),
    );
  },
);

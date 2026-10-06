import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Effect, FileSystem, Schema } from 'effect';
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
      throw new UnsupportedDatabaseVersionError('untracked schema');
    return;
  }
  const applied = appliedHashes(database);
  if (
    (applied.length === 0 && tables.length > 1) ||
    applied.some((hash, index) => hash !== shipped[index]?.hash)
  )
    throw new UnsupportedDatabaseVersionError('incompatible migration history');
}

export const upgradeLegacyDatabase = Effect.fn('Storage.upgradeLegacyDatabase')(
  function* (
    filename: string,
    options: { worktreeIdLength: number; busyTimeoutMs: number },
  ) {
    const shipped = yield* readLegacyMigrations();
    yield* Effect.acquireUseRelease(
      Effect.sync(() => new DatabaseSync(filename)),
      (database) =>
        Effect.sync(() => {
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
              throw new UnsupportedDatabaseVersionError('orphaned rows');
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

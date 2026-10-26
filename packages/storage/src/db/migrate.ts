import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { Effect, FileSystem, Schema } from 'effect';
import { Migrator, SqlClient } from 'effect/sql';
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
  '002_project_review_revisions': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DROP TABLE review_proof_files`;
    yield* sql`DROP TABLE reviews`;
    yield* sql`DROP TABLE reviewed_layers`;
    yield* sql`CREATE TABLE reviews (
      review_id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      common_directory TEXT NOT NULL,
      branch TEXT NOT NULL,
      pull_request TEXT,
      pull_request_number INTEGER,
      state TEXT NOT NULL CHECK(state IN ('open', 'closed')),
      latest_revision INTEGER NOT NULL CHECK(latest_revision > 0)
    )`;
    yield* sql`CREATE UNIQUE INDEX reviews_open_pr ON reviews(project_id, pull_request_number) WHERE state = 'open' AND pull_request IS NOT NULL`;
    yield* sql`CREATE UNIQUE INDEX reviews_open_branch ON reviews(project_id, branch) WHERE state = 'open' AND pull_request IS NULL`;
    yield* sql`CREATE TABLE review_seen (
      review_id TEXT PRIMARY KEY NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
      last_seen_revision INTEGER NOT NULL CHECK(last_seen_revision >= 0)
    )`;
    yield* sql`CREATE TABLE review_revisions (
      review_id TEXT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision > 0),
      project_id TEXT NOT NULL,
      common_directory TEXT NOT NULL,
      worktree_id TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      worktree_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      head_oid TEXT NOT NULL,
      base TEXT NOT NULL,
      base_oid TEXT NOT NULL,
      merge_base_oid TEXT NOT NULL,
      published_at TEXT NOT NULL,
      active INTEGER NOT NULL CHECK(active IN (0, 1)),
      files TEXT NOT NULL,
      not_explained TEXT NOT NULL,
      verdict TEXT NOT NULL,
      summary_html TEXT NOT NULL,
      summary_token TEXT NOT NULL UNIQUE,
      summary_secret TEXT NOT NULL,
      diagram TEXT,
      layers TEXT NOT NULL,
      proof TEXT,
      PRIMARY KEY(review_id, revision)
    )`;
    yield* sql`CREATE TABLE review_proof_files (
      review_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      PRIMARY KEY(review_id, revision, id),
      FOREIGN KEY(review_id, revision) REFERENCES review_revisions(review_id, revision) ON DELETE CASCADE
    )`;
    yield* sql`CREATE TABLE reviewed_layers (
      review_id TEXT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
      layer_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      PRIMARY KEY(review_id, layer_id, fingerprint)
    )`;
    yield* sql`CREATE TABLE new_reviewed_files (
      worktree_id TEXT REFERENCES worktree_presence(worktree_id) ON DELETE CASCADE,
      review_id TEXT REFERENCES reviews(review_id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      branch TEXT NOT NULL,
      path TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      stale INTEGER NOT NULL,
      CHECK((worktree_id IS NULL) != (review_id IS NULL))
    )`;
    yield* sql`INSERT INTO new_reviewed_files SELECT worktree_id, NULL, scope, branch, path, fingerprint, reviewed_at, stale FROM reviewed_files`;
    yield* sql`DROP TABLE reviewed_files`;
    yield* sql`ALTER TABLE new_reviewed_files RENAME TO reviewed_files`;
    yield* sql`CREATE UNIQUE INDEX reviewed_files_worktree_key ON reviewed_files(worktree_id, scope, branch, path) WHERE worktree_id IS NOT NULL`;
    yield* sql`CREATE UNIQUE INDEX reviewed_files_review_key ON reviewed_files(review_id, path, fingerprint) WHERE review_id IS NOT NULL`;
    yield* sql`CREATE TABLE new_comment_threads (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      id TEXT NOT NULL UNIQUE,
      worktree_id TEXT REFERENCES worktree_presence(worktree_id) ON DELETE CASCADE,
      review_id TEXT REFERENCES reviews(review_id) ON DELETE CASCADE,
      source_worktree_id TEXT NOT NULL,
      review_revision INTEGER,
      head_oid TEXT,
      anchor TEXT NOT NULL,
      resolved INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      last_agent_revision INTEGER,
      size_bytes INTEGER NOT NULL,
      CHECK((worktree_id IS NULL) != (review_id IS NULL)),
      CHECK((review_id IS NULL AND review_revision IS NULL AND head_oid IS NULL) OR (review_id IS NOT NULL AND review_revision IS NOT NULL AND head_oid IS NOT NULL)),
      FOREIGN KEY(review_id, review_revision) REFERENCES review_revisions(review_id, revision) ON DELETE CASCADE
    )`;
    yield* sql`INSERT INTO new_comment_threads SELECT sequence, id, worktree_id, NULL, worktree_id, NULL, NULL, anchor, resolved, revision, last_agent_revision, size_bytes FROM comment_threads`;
    yield* sql`CREATE TABLE new_comment_messages (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      id TEXT NOT NULL,
      thread_id TEXT NOT NULL REFERENCES new_comment_threads(id) ON DELETE CASCADE,
      worktree_id TEXT,
      body TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at TEXT,
      edited_at TEXT
    )`;
    yield* sql`INSERT INTO new_comment_messages SELECT sequence, id, thread_id, worktree_id, body, author, created_at, edited_at FROM comment_messages`;
    yield* sql`DROP TABLE comment_messages`;
    yield* sql`DROP TABLE comment_threads`;
    yield* sql`ALTER TABLE new_comment_threads RENAME TO comment_threads`;
    yield* sql`ALTER TABLE new_comment_messages RENAME TO comment_messages`;
    yield* sql`CREATE INDEX comment_threads_worktree ON comment_threads(worktree_id)`;
    yield* sql`CREATE INDEX comment_threads_review ON comment_threads(review_id)`;
    yield* sql`CREATE INDEX comment_messages_id ON comment_messages(id)`;
    yield* sql`CREATE INDEX comment_messages_thread ON comment_messages(thread_id, sequence)`;
  }),
  '004_archive_reviews': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE reviews ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1))`;
  }),
  '005_review_git_settings': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE review_git_settings (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision > 0),
      settings TEXT NOT NULL
    )`;
  }),
  '003_project_github_accounts': Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE project_github_accounts (
      project_id TEXT PRIMARY KEY NOT NULL REFERENCES inventory_projects(id) ON DELETE CASCADE,
      repository TEXT NOT NULL, detected TEXT, override TEXT
    )`;
  }),
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
            if (
              database
                .prepare(
                  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'porcelain_git_action_execution_v1'",
                )
                .get()
            )
              database.exec(
                'DELETE FROM porcelain_git_action_execution_v1 WHERE request_id NOT IN (SELECT request_id FROM git_action_receipts)',
              );
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

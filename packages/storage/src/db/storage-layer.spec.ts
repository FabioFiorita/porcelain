import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import {
  EnvironmentIdentityReader,
  DeviceStore,
} from '@porcelain/access/ports';
import { InventoryStore } from '@porcelain/projects/ports';
import { CommentStore } from '@porcelain/reviews/ports';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storageLayer } from './storage-layer.ts';

const journalSchema = Schema.fromJsonString(
  Schema.Struct({
    entries: Schema.Array(
      Schema.Struct({ tag: Schema.String, when: Schema.Number }),
    ),
  }),
);
const environmentId = '782d54c7-335c-4ad4-b56f-29933e0f3355';
const at = '2026-01-01T00:00:00.000Z';

function applyLegacyMigrations(directory: string, count?: number) {
  const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
  const source = new URL('../../drizzle/', import.meta.url);
  const journal = Schema.decodeUnknownSync(journalSchema)(
    readFileSync(new URL('meta/_journal.json', source), 'utf8'),
  );
  database.function(
    'porcelain_worktree_id',
    { varargs: true },
    () => 'unused-empty-worktree-fixture',
  );
  database.exec(
    'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
  );
  for (const entry of journal.entries.slice(0, count)) {
    const sql = readFileSync(new URL(`${entry.tag}.sql`, source), 'utf8');
    database.exec(sql);
    database
      .prepare(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      )
      .run(createHash('sha256').update(sql).digest('hex'), entry.when);
  }
  return database;
}

function legacyDatabase(directory: string, count?: number) {
  const database = applyLegacyMigrations(directory, count);
  database.exec(`INSERT INTO environment VALUES (1, '${environmentId}');
    INSERT INTO inventory_projects VALUES ('project', 'Preserved project', 1, '/repo/.git', 'repository', 1, 4);
    INSERT INTO worktree_presence VALUES ('worktree', 'project', NULL);
    INSERT INTO devices (id, label, platform, secret_hash, created_at, last_seen_at, last_seen_address, route, route_inferred, revoked_at) VALUES ('device', 'Owner tablet', 'ios', 'hash', '${at}', '${at}', NULL, 'lan', 0, NULL);
    UPDATE comment_revision SET revision = 37 WHERE singleton = 1;`);
  if (count === undefined)
    database.exec("UPDATE devices SET trusted = 1 WHERE id = 'device'");
  database.close();
}

function snapshot(directory: string) {
  const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    const schema = database
      .prepare(
        'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name',
      )
      .all();
    return {
      journalMode: database.prepare('PRAGMA journal_mode').get(),
      userVersion: database.prepare('PRAGMA user_version').get(),
      schema,
      rows: schema
        .filter((object) => object.type === 'table')
        .map((table) => ({
          name: table.name,
          rows: database
            .prepare(
              `SELECT * FROM "${String(table.name).replaceAll('"', '""')}"`,
            )
            .all(),
        })),
    };
  } finally {
    database.close();
  }
}

function runtime(directory: string) {
  return ManagedRuntime.make(
    storageLayer(directory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
}

describe('Native storage adoption', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'porcelain-legacy-storage-'));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('adopts a shipped database without changing identity, device trust, project order or comment revisions', async () => {
    legacyDatabase(directory);
    const session = runtime(directory);
    try {
      const state = await session.runPromise(
        Effect.gen(function* () {
          const identity = yield* EnvironmentIdentityReader;
          const devices = yield* DeviceStore;
          const inventory = yield* InventoryStore;
          const comments = yield* CommentStore;
          return {
            environmentId: yield* identity.environmentId(),
            device: yield* devices.find({ deviceId: 'device' }),
            inventory: yield* inventory.read(),
            thread: yield* comments.insert({
              content: {
                id: 'thread',
                worktreeId: 'worktree',
                anchor: { kind: 'file', filePath: 'README.md' },
                messages: [
                  {
                    id: 'opening',
                    body: 'Preserve revisions',
                    author: 'reviewer',
                    createdAt: at,
                  },
                ],
              },
              sizeBytes: 18,
              writtenByAgent: false,
            }),
          };
        }),
      );
      expect(state.environmentId).toBe(environmentId);
      expect(state.device).toEqual({
        id: 'device',
        label: 'Owner tablet',
        platform: 'ios',
        secretHash: 'hash',
        createdAt: at,
        lastSeenAt: at,
        route: 'lan',
        trusted: true,
      });
      expect(state.inventory.projects).toEqual([
        {
          id: 'project',
          name: 'Preserved project',
          namedByOwner: true,
          commonDirectory: '/repo/.git',
          repositoryIdentity: 'repository',
          available: true,
          position: 4,
        },
      ]);
      expect(state.thread.revision).toBe(38);
    } finally {
      await session.dispose();
    }
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(
        database
          .prepare('SELECT migration_id, name FROM porcelain_migrations')
          .all(),
      ).toEqual([{ migration_id: 1, name: 'adopt_legacy_schema' }]);
    } finally {
      database.close();
    }
  });

  it('refuses a modified migration ledger without changing persisted rows', async () => {
    legacyDatabase(directory);
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    database.exec(
      "UPDATE __drizzle_migrations SET hash = 'unrecognized' WHERE rowid = 1",
    );
    database.close();
    const session = runtime(directory);
    try {
      await expect(
        session.runPromise(EnvironmentIdentityReader),
      ).rejects.toThrow('Unsupported inventory database version');
    } finally {
      await session.dispose();
    }
    const stored = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(stored.prepare('SELECT id FROM environment').all()).toEqual([
        { id: environmentId },
      ]);
      expect(
        stored
          .prepare('SELECT hash FROM __drizzle_migrations WHERE rowid = 1')
          .all(),
      ).toEqual([{ hash: 'unrecognized' }]);
    } finally {
      stored.close();
    }
  });

  it('refuses a database created by a newer native migration without changing its identity', async () => {
    const current = runtime(directory);
    await current.runPromise(EnvironmentIdentityReader);
    await current.dispose();
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    database.exec(
      "UPDATE environment SET id = '782d54c7-335c-4ad4-b56f-29933e0f3355'; INSERT INTO porcelain_migrations (migration_id, name) VALUES (999, 'future_schema');",
    );
    database.close();
    const session = runtime(directory);
    try {
      await expect(
        session.runPromise(EnvironmentIdentityReader),
      ).rejects.toThrow('Unsupported inventory database version');
    } finally {
      await session.dispose();
    }
    const stored = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(stored.prepare('SELECT id FROM environment').all()).toEqual([
        { id: environmentId },
      ]);
    } finally {
      stored.close();
    }
  });

  it('refuses an untracked schema instead of overwriting its data', async () => {
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    database.exec(
      "CREATE TABLE existing_data (value text); INSERT INTO existing_data VALUES ('preserve');",
    );
    database.close();
    const session = runtime(directory);
    try {
      await expect(
        session.runPromise(EnvironmentIdentityReader),
      ).rejects.toThrow('Unsupported inventory database version');
    } finally {
      await session.dispose();
    }
    const stored = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(stored.prepare('SELECT value FROM existing_data').all()).toEqual([
        { value: 'preserve' },
      ]);
    } finally {
      stored.close();
    }
  });

  it.each([
    {
      history: 'a newer native migration',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at text)',
      rows: "INSERT INTO porcelain_migrations VALUES (999, 'future_schema', 'future')",
    },
    {
      history: 'a gapped native ledger',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at text)',
      rows: "INSERT INTO porcelain_migrations VALUES (2, 'adopt_legacy_schema', 'future')",
    },
    {
      history: 'a renamed native migration',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at text)',
      rows: "INSERT INTO porcelain_migrations VALUES (1, 'different_schema', 'future')",
    },
    {
      history: 'a malformed native migration id',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id text PRIMARY KEY, name text NOT NULL, created_at text)',
      rows: "INSERT INTO porcelain_migrations VALUES ('invalid', 'adopt_legacy_schema', 'future')",
    },
    {
      history: 'an empty native ledger missing a column',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL)',
      rows: '',
    },
    {
      history: 'a native ledger with an unknown column',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at text, future text)',
      rows: "INSERT INTO porcelain_migrations VALUES (1, 'adopt_legacy_schema', 'future', 'preserve')",
    },
    {
      history: 'a view in place of the native migration table',
      schema:
        "CREATE VIEW porcelain_migrations AS SELECT 1 AS migration_id, 'adopt_legacy_schema' AS name, 'future' AS created_at",
      rows: '',
    },
  ])(
    'refuses $history before upgrading a known legacy prefix or changing journal mode',
    async ({ schema, rows }) => {
      legacyDatabase(directory, 27);
      const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
      database.exec(schema);
      if (rows) database.exec(rows);
      database.close();
      const before = snapshot(directory);
      expect(before.journalMode).toEqual({ journal_mode: 'delete' });
      const session = runtime(directory);
      try {
        await expect(
          session.runPromise(EnvironmentIdentityReader),
        ).rejects.toThrow('Unsupported inventory database version');
      } finally {
        await session.dispose();
      }
      expect(snapshot(directory)).toEqual(before);
    },
  );

  it('upgrades a recognized legacy prefix and preserves its values without a native ledger', async () => {
    legacyDatabase(directory, 27);
    const session = runtime(directory);
    try {
      const state = await session.runPromise(
        Effect.gen(function* () {
          const identity = yield* EnvironmentIdentityReader;
          const devices = yield* DeviceStore;
          const inventory = yield* InventoryStore;
          return {
            environmentId: yield* identity.environmentId(),
            device: yield* devices.find({ deviceId: 'device' }),
            projects: (yield* inventory.read()).projects,
          };
        }),
      );
      expect(state.environmentId).toBe(environmentId);
      expect(state.device).toMatchObject({ label: 'Owner tablet' });
      expect(state.projects).toEqual([
        {
          id: 'project',
          name: 'Preserved project',
          namedByOwner: true,
          commonDirectory: '/repo/.git',
          repositoryIdentity: 'repository',
          available: true,
          position: 4,
        },
      ]);
    } finally {
      await session.dispose();
    }
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(
        database
          .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
          .get(),
      ).toEqual({ count: 28 });
      expect(
        database.prepare('SELECT revision FROM comment_revision').get(),
      ).toEqual({ revision: 37 });
      expect(
        database
          .prepare("SELECT trusted FROM devices WHERE id = 'device'")
          .get(),
      ).toEqual({ trusted: 0 });
      expect(
        database
          .prepare('SELECT migration_id, name FROM porcelain_migrations')
          .all(),
      ).toEqual([{ migration_id: 1, name: 'adopt_legacy_schema' }]);
      expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it('preserves reviewed-file values and their derived worktree identity when upgrading older legacy data', async () => {
    const database = applyLegacyMigrations(directory, 4);
    database.exec(`INSERT INTO environment VALUES (1, '${environmentId}');
      INSERT INTO inventory_projects VALUES ('project', 'Preserved project', '/repo/.git', 'repository', 1, 4);
      INSERT INTO worktrees VALUES ('old-worktree', 'project', '/repo', 'metadata-identity', 1, 'main', 1, 1);
      INSERT INTO project_worktrees VALUES ('old-worktree', 'project');
      INSERT INTO reviewed_files VALUES ('old-worktree', 'README.md', 'preserved-fingerprint', '${at}');`);
    database.close();
    const session = runtime(directory);
    try {
      expect(
        await session.runPromise(
          Effect.gen(function* () {
            const identity = yield* EnvironmentIdentityReader;
            return yield* identity.environmentId();
          }),
        ),
      ).toBe(environmentId);
    } finally {
      await session.dispose();
    }
    const stored = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(
        stored
          .prepare(
            'SELECT worktree_id, project_id, missing_since FROM worktree_presence',
          )
          .all(),
      ).toEqual([
        {
          worktree_id: 'd69cdefd94d8b39951ff1214668d22d4',
          project_id: 'project',
          missing_since: null,
        },
      ]);
      expect(
        stored
          .prepare(
            'SELECT worktree_id, path, fingerprint, reviewed_at FROM reviewed_files',
          )
          .all(),
      ).toEqual([
        {
          worktree_id: 'd69cdefd94d8b39951ff1214668d22d4',
          path: 'README.md',
          fingerprint: 'preserved-fingerprint',
          reviewed_at: at,
        },
      ]);
      expect(stored.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      stored.close();
    }
  });

  it('rolls back pending legacy migrations when the existing rows violate foreign keys', async () => {
    legacyDatabase(directory, 27);
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    database.exec('PRAGMA foreign_keys = OFF');
    database.exec(
      "INSERT INTO worktree_presence VALUES ('orphan', 'missing-project', NULL)",
    );
    database.close();
    const before = snapshot(directory);
    const session = runtime(directory);
    try {
      await expect(
        session.runPromise(EnvironmentIdentityReader),
      ).rejects.toThrow('Unsupported inventory database version');
    } finally {
      await session.dispose();
    }
    const after = snapshot(directory);
    expect(after.schema).toEqual(before.schema);
    expect(after.rows).toEqual(before.rows);
  });
});

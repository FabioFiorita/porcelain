import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
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
import { upgradeLegacyDatabase } from './migrate.ts';
import { worktreeIdV1 } from './worktree-id-v1.ts';
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
  database.function(
    'porcelain_stable_worktree_ids',
    { varargs: true },
    () => '[]',
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
      history:
        'an empty native ledger with a required timestamp and no default',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at TEXT NOT NULL)',
      rows: '',
    },
    {
      history:
        'an empty native ledger with a required timestamp defaulting to null',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at TEXT NOT NULL DEFAULT NULL)',
      rows: '',
    },
    {
      history:
        'an empty native ledger whose required timestamp default evaluates to null',
      schema:
        'CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY, name text NOT NULL, created_at TEXT NOT NULL DEFAULT (lower(NULL)))',
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
      ).toEqual({ count: 29 });
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

  it.each([
    { timestamp: 'a nullable timestamp', definition: 'TEXT' },
    {
      timestamp: 'the native migrator timestamp default',
      definition: 'DATETIME NOT NULL DEFAULT current_timestamp',
    },
    {
      timestamp: 'a non-null timestamp expression',
      definition:
        "TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))",
    },
  ])(
    'adopts an empty compatible native ledger with $timestamp and reopens its recorded history',
    async ({ definition }) => {
      legacyDatabase(directory, 27);
      const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
      database.exec(
        `CREATE TABLE porcelain_migrations (migration_id integer PRIMARY KEY NOT NULL, name VARCHAR(255) NOT NULL, created_at ${definition})`,
      );
      database.close();
      const open = async () => {
        const session = runtime(directory);
        try {
          return await session.runPromise(
            Effect.gen(function* () {
              const identity = yield* EnvironmentIdentityReader;
              return yield* identity.environmentId();
            }),
          );
        } finally {
          await session.dispose();
        }
      };
      expect(await open()).toBe(environmentId);
      expect(await open()).toBe(environmentId);
      const stored = new DatabaseSync(join(directory, 'inventory.sqlite'));
      try {
        expect(
          stored
            .prepare('SELECT migration_id, name FROM porcelain_migrations')
            .all(),
        ).toEqual([{ migration_id: 1, name: 'adopt_legacy_schema' }]);
        expect(
          stored
            .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
            .get(),
        ).toEqual({ count: 29 });
      } finally {
        stored.close();
      }
    },
  );

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

it('heals repository identities and carries every worktree row from surviving administrative directories once', async ({
  onTestFinished,
}) => {
  const directory = mkdtempSync(join(tmpdir(), 'porcelain-stable-storage-'));
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
  const commonDirectory = join(directory, '.git');
  const linked = join(commonDirectory, 'worktrees', 'feature');
  mkdirSync(linked, { recursive: true });
  const metadata = [commonDirectory, linked].map((path) =>
    statSync(path, { bigint: true }),
  );
  const oldIds = metadata.map((info) =>
    worktreeIdV1('project', `${info.dev}:${info.ino}:${info.birthtimeNs}`, 32),
  );
  const newIds = metadata.map((info) =>
    worktreeIdV1('project', `${info.ino}:${info.birthtimeNs}`, 32),
  );
  const database = applyLegacyMigrations(directory, 28);
  database
    .prepare('INSERT INTO inventory_projects VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(
      'project',
      'Preserved project',
      1,
      commonDirectory,
      `16777230:${metadata[0]!.ino}:${metadata[0]!.birthtimeNs}`,
      0,
      4,
    );
  for (const [index, id] of oldIds.entries()) {
    database
      .prepare('INSERT INTO worktree_presence VALUES (?, ?, ?)')
      .run(id, 'project', null);
    database
      .prepare(
        'INSERT INTO reviews (worktree_id, revision, published_at, summary_html, summary_token, summary_secret, layers) VALUES (?, 3, ?, ?, ?, ?, ?)',
      )
      .run(id, at, 'Keep this review', `token-${index}`, 'secret', '[]');
    database
      .prepare(
        'INSERT INTO reviewed_files (worktree_id, path, fingerprint, reviewed_at, stale, scope, branch) VALUES (?, ?, ?, ?, 0, ?, ?)',
      )
      .run(id, 'README.md', 'fingerprint', at, 'worktree', '');
    database
      .prepare('INSERT INTO reviewed_layers VALUES (?, ?, ?, ?)')
      .run(id, 'layer', 'fingerprint', at);
    database
      .prepare(
        'INSERT INTO comment_threads (id, worktree_id, anchor, resolved, revision, size_bytes) VALUES (?, ?, ?, 0, 7, 8)',
      )
      .run(`thread-${index}`, id, '{}');
    database
      .prepare(
        'INSERT INTO comment_messages (id, thread_id, worktree_id, body, author, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        `message-${index}`,
        `thread-${index}`,
        id,
        'Keep this comment',
        'human',
        at,
      );
    database.prepare('INSERT INTO comment_reads VALUES (?, 7)').run(id);
    database
      .prepare(
        'INSERT INTO git_action_receipts (request_id, project_id, worktree_id, action, state, refresh_required, accepted_at, intent, expected, progress) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
      )
      .run(
        `receipt-${index}`,
        'project',
        id,
        'commit',
        'completed',
        at,
        '{}',
        '{}',
        '[]',
      );
    database
      .prepare('INSERT INTO review_proof_files VALUES (?, ?, ?, ?)')
      .run(id, 'proof', 'image/png', new Uint8Array([1, 2, 3]));
  }
  database
    .prepare('INSERT INTO worktree_presence VALUES (?, ?, ?)')
    .run('gone-worktree', 'project', at);
  database
    .prepare('INSERT INTO comment_reads VALUES (?, 9)')
    .run('gone-worktree');
  database
    .prepare('INSERT INTO project_file_preferences VALUES (?, ?, 1, 0)')
    .run('project', 'README.md');
  database.close();
  const upgrade = () =>
    Effect.runPromise(
      upgradeLegacyDatabase(join(directory, 'inventory.sqlite'), {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Effect.provide(NodeServices.layer)),
    );
  await upgrade();
  const reopened = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    expect(
      reopened
        .prepare('SELECT repository_identity, position FROM inventory_projects')
        .get(),
    ).toEqual({
      repository_identity: `${metadata[0]!.ino}:${metadata[0]!.birthtimeNs}`,
      position: 4,
    });
    const carried = Object.fromEntries(
      [
        'reviews',
        'reviewed_files',
        'reviewed_layers',
        'comment_threads',
        'comment_messages',
        'git_action_receipts',
        'review_proof_files',
      ].map((table) => [
        table,
        reopened
          .prepare(`SELECT worktree_id FROM ${table} ORDER BY worktree_id`)
          .all(),
      ]),
    );
    const ids = [...newIds].sort().map((worktree_id) => ({ worktree_id }));
    expect(carried).toEqual({
      reviews: ids,
      reviewed_files: ids,
      reviewed_layers: ids,
      comment_threads: ids,
      comment_messages: ids,
      git_action_receipts: ids,
      review_proof_files: ids,
    });
    expect(
      reopened
        .prepare(
          'SELECT worktree_id, seen_through FROM comment_reads ORDER BY worktree_id',
        )
        .all(),
    ).toEqual(
      [
        ...newIds.map((worktree_id) => ({ worktree_id, seen_through: 7 })),
        { worktree_id: 'gone-worktree', seen_through: 9 },
      ].sort((a, b) => a.worktree_id.localeCompare(b.worktree_id)),
    );
    expect(
      reopened
        .prepare(
          'SELECT worktree_id, missing_since FROM worktree_presence ORDER BY worktree_id',
        )
        .all(),
    ).toEqual(
      [
        ...newIds.map((worktree_id) => ({ worktree_id, missing_since: null })),
        { worktree_id: 'gone-worktree', missing_since: at },
      ].sort((a, b) => a.worktree_id.localeCompare(b.worktree_id)),
    );
    expect(reopened.prepare('SELECT summary_html FROM reviews').all()).toEqual([
      { summary_html: 'Keep this review' },
      { summary_html: 'Keep this review' },
    ]);
    expect(reopened.prepare('SELECT body FROM comment_messages').all()).toEqual(
      [{ body: 'Keep this comment' }, { body: 'Keep this comment' }],
    );
    expect(
      reopened
        .prepare('SELECT path, pinned, hidden FROM project_file_preferences')
        .all(),
    ).toEqual([{ path: 'README.md', pinned: 1, hidden: 0 }]);
    expect(reopened.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {
    reopened.close();
  }
  const before = snapshot(directory);
  await upgrade();
  expect(snapshot(directory)).toEqual(before);
});

it('heals duplicate registrations after a mount change without deleting either project or its data', async ({
  onTestFinished,
}) => {
  const directory = mkdtempSync(join(tmpdir(), 'porcelain-duplicate-storage-'));
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
  const commonDirectory = join(directory, '.git');
  mkdirSync(commonDirectory);
  const info = statSync(commonDirectory, { bigint: true });
  const stable = `${info.ino}:${info.birthtimeNs}`;
  const database = applyLegacyMigrations(directory, 28);
  database
    .prepare('INSERT INTO inventory_projects VALUES (?, ?, 1, ?, ?, 0, 1)')
    .run('first', 'Original project', commonDirectory, `16777230:${stable}`);
  database
    .prepare('INSERT INTO inventory_projects VALUES (?, ?, 1, ?, ?, 0, 2)')
    .run('second', 'Re-added project', commonDirectory, `16777233:${stable}`);
  database
    .prepare('INSERT INTO worktree_presence VALUES (?, ?, NULL)')
    .run(worktreeIdV1('first', `${info.dev}:${stable}`, 32), 'first');
  database
    .prepare('INSERT INTO worktree_presence VALUES (?, ?, NULL)')
    .run(worktreeIdV1('second', `${info.dev}:${stable}`, 32), 'second');
  database
    .prepare('INSERT INTO comment_reads VALUES (?, 11)')
    .run(worktreeIdV1('first', `${info.dev}:${stable}`, 32));
  database
    .prepare('INSERT INTO comment_reads VALUES (?, 17)')
    .run(worktreeIdV1('second', `${info.dev}:${stable}`, 32));
  database.close();
  await expect(
    Effect.runPromise(
      upgradeLegacyDatabase(join(directory, 'inventory.sqlite'), {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  ).resolves.toBeUndefined();
  const reopened = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    expect(
      reopened
        .prepare(
          'SELECT id, name, repository_identity FROM inventory_projects ORDER BY position',
        )
        .all(),
    ).toEqual([
      { id: 'first', name: 'Original project', repository_identity: stable },
      { id: 'second', name: 'Re-added project', repository_identity: stable },
    ]);
    expect(
      reopened
        .prepare('SELECT seen_through FROM comment_reads WHERE worktree_id = ?')
        .get(worktreeIdV1('first', stable, 32)),
    ).toEqual({ seen_through: 11 });
    expect(
      reopened
        .prepare('SELECT seen_through FROM comment_reads WHERE worktree_id = ?')
        .get(worktreeIdV1('second', stable, 32)),
    ).toEqual({ seen_through: 17 });
    expect(reopened.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {
    reopened.close();
  }
});

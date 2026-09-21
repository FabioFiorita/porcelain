import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { deriveWorktreeId } from '../models/worktree-id.ts';
import { openDatabase } from './connection.ts';

const migrationsPath = join(import.meta.dirname, '../../drizzle');

/** Everything shipped before worktrees became derived. */
const before = [
  ['0000_current-schema.sql', 1788921607579],
  ['0001_light_iceman.sql', 1789345784383],
  ['0002_backfill_comment_authors.sql', 1789347169518],
  ['0003_pairing_and_devices.sql', 1789882726950],
] as const;

const project = '11111111-1111-4111-8111-111111111111';
const mapped = '22222222-2222-4222-8222-222222222222';
const identity = '2049:404:1758000000000000000';
/** A worktree that was unavailable at the last refresh: no identity to derive. */
const unrecorded = '33333333-3333-4333-8333-333333333333';
/** A worktree that had already left the active table before the upgrade. */
const departed = '44444444-4444-4444-8444-444444444444';

async function legacyDatabase(directory: string) {
  const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
  try {
    for (const [name] of before)
      database.exec(await readFile(join(migrationsPath, name), 'utf8'));
    database.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);',
    );
    for (const [name, when] of before) {
      const source = await readFile(join(migrationsPath, name), 'utf8');
      database
        .prepare(
          'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        )
        .run(createHash('sha256').update(source).digest('hex'), when);
    }
    database
      .prepare('INSERT INTO environment (singleton, id) VALUES (1, ?)')
      .run('fixture-environment');
    database
      .prepare(
        'INSERT INTO inventory_projects (id, name, common_directory, repository_identity, available, position) VALUES (?, ?, ?, ?, 1, 0)',
      )
      .run(project, 'fixture', '/fixture/project/.git', '2049:1:1');
    database
      .prepare(
        'INSERT INTO worktrees (id, project_id, path, metadata_identity, main, branch, available, position) VALUES (?, ?, ?, ?, 1, ?, 1, 0)',
      )
      .run(mapped, project, '/fixture/project', identity, 'refs/heads/main');
    database
      .prepare(
        'INSERT INTO worktrees (id, project_id, path, metadata_identity, main, branch, available, position) VALUES (?, ?, ?, NULL, 0, ?, 0, 1)',
      )
      .run(unrecorded, project, '/fixture/unplugged', 'refs/heads/review');
    for (const id of [mapped, unrecorded, departed])
      database
        .prepare(
          'INSERT INTO project_worktrees (worktree_id, project_id) VALUES (?, ?)',
        )
        .run(id, project);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

function thread(worktreeId: string, id: string) {
  return {
    id,
    worktreeId,
    anchor: {
      kind: 'codeRange',
      filePath: 'src/task-store.mjs',
      startLine: 1,
      endLine: 2,
      side: 'additions',
      revision: 'abc',
      contentFingerprint: 'fingerprint',
    },
    resolved: false,
    messages: [
      {
        id: 'message',
        author: 'reviewer',
        body: 'Worth a second look.',
        createdAt: '2026-09-14T01:00:00.000Z',
      },
    ],
  };
}

it('moves every stored worktree id to its derived one, payloads included', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-worktree-migration-'));
  try {
    const legacy = await legacyDatabase(root);
    try {
      for (const [worktreeId, threadId] of [
        [mapped, 'mapped-thread'],
        [unrecorded, 'unrecorded-thread'],
        [departed, 'departed-thread'],
      ] as const)
        legacy
          .prepare(
            'INSERT INTO comment_threads (id, worktree_id, data) VALUES (?, ?, ?)',
          )
          .run(
            threadId,
            worktreeId,
            JSON.stringify(thread(worktreeId, threadId)),
          );
      legacy
        .prepare(
          'INSERT INTO reviewed_files (worktree_id, path, fingerprint, reviewed_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          mapped,
          'src/task-store.mjs',
          'fingerprint',
          '2026-09-14T01:00:00.000Z',
        );
      legacy
        .prepare(
          'INSERT INTO review_layer_sets (worktree_id, revision, layers) VALUES (?, ?, ?)',
        )
        .run(mapped, 1, JSON.stringify([]));
      legacy
        .prepare(
          'INSERT INTO artifacts (id, worktree_id, name, content, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(
          'artifact',
          mapped,
          'handoff.md',
          '# Handoff',
          9,
          '2026-09-14T01:00:00.000Z',
        );
      legacy
        .prepare(
          'INSERT INTO commit_review_layer_sets (project_id, commit_oid, data) VALUES (?, ?, ?)',
        )
        .run(
          project,
          'commit',
          JSON.stringify({ sourceWorktreeId: mapped, layers: [] }),
        );
      legacy
        .prepare(
          'INSERT INTO git_action_preparations (id, value, consumed) VALUES (?, ?, 0)',
        )
        .run(
          'preparation',
          JSON.stringify({
            id: 'preparation',
            projectId: project,
            worktreeId: mapped,
            expiresAt: 1,
          }),
        );
      legacy
        .prepare(
          'INSERT INTO git_action_receipts (request_id, value) VALUES (?, ?)',
        )
        .run(
          'request',
          JSON.stringify({
            requestId: 'request',
            projectId: project,
            worktreeId: mapped,
          }),
        );
    } finally {
      legacy.close();
    }

    const derived = deriveWorktreeId(project, identity);
    const { db, close } = openDatabase(root);
    try {
      const query = <T>(sql: string): T[] =>
        db.$client.prepare(sql).all() as T[];

      // The columns.
      expect(
        query<{ worktree_id: string }>(
          'SELECT worktree_id FROM reviewed_files',
        ),
      ).toEqual([{ worktree_id: derived }]);
      expect(
        query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE name IN ('review_layer_sets', 'artifacts', 'commit_review_layer_sets')",
        ),
      ).toEqual([]);

      // The payloads. A column that moved while its JSON did not would return
      // an id nothing resolves, which is why these are asserted and not counts.
      const threads = query<{
        id: string;
        worktree_id: string;
        anchor: string;
      }>('SELECT id, worktree_id, anchor FROM comment_threads ORDER BY id');
      const byId = new Map(threads.map((row) => [row.id, row]));
      const migrated = byId.get('mapped-thread');
      expect(migrated?.worktree_id).toBe(derived);
      expect(JSON.parse(migrated?.anchor ?? '{}')).toEqual(
        thread(derived, 'mapped-thread').anchor,
      );
      // Nothing else about the thread moved, and the denormalized message
      // scope followed the same mapping as its parent.
      expect(
        query<{
          id: string;
          worktree_id: string;
          body: string;
          author: string;
          created_at: string | null;
        }>(
          "SELECT id, worktree_id, body, author, created_at FROM comment_messages WHERE thread_id = 'mapped-thread'",
        ),
      ).toEqual(
        thread(derived, 'mapped-thread').messages.map((message) => ({
          id: message.id,
          worktree_id: derived,
          body: message.body,
          author: message.author,
          created_at: message.createdAt,
        })),
      );

      expect(
        JSON.parse(
          query<{ value: string }>(
            'SELECT value FROM git_action_preparations',
          )[0]?.value ?? '{}',
        ).worktreeId,
      ).toBe(derived);
      expect(
        JSON.parse(
          query<{ value: string }>('SELECT value FROM git_action_receipts')[0]
            ?.value ?? '{}',
        ).worktreeId,
      ).toBe(derived);

      // Unmappable rows keep their legacy ids rather than being attached by
      // path or dropped. They are disclosed, not silently lost.
      const unmapped = byId.get('unrecorded-thread');
      expect(unmapped?.worktree_id).toBe(unrecorded);
      expect(byId.get('departed-thread')?.worktree_id).toBe(departed);

      // Everything with review data has a presence row, and nothing has begun
      // its grace period: absence is only ever observed by a live listing.
      expect(
        query<{ worktree_id: string; missing_since: string | null }>(
          'SELECT worktree_id, missing_since FROM worktree_presence ORDER BY worktree_id',
        ).map((row) => row.missing_since),
      ).toEqual([null, null, null]);
      expect(
        new Set(
          query<{ worktree_id: string }>(
            'SELECT worktree_id FROM worktree_presence',
          ).map((row) => row.worktree_id),
        ),
      ).toEqual(new Set([derived, unrecorded, departed]));

      // The tables Git replaces are gone.
      expect(
        query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE name IN ('worktrees', 'project_worktrees')",
        ),
      ).toEqual([]);
    } finally {
      close();
    }

    // Reopening applies nothing further and still works.
    const again = openDatabase(root);
    again.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('leaves every legacy id intact when the rewrite cannot finish', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-worktree-partial-'));
  try {
    const legacy = await legacyDatabase(root);
    const derived = deriveWorktreeId(project, identity);
    try {
      legacy
        .prepare(
          'INSERT INTO comment_threads (id, worktree_id, data) VALUES (?, ?, ?)',
        )
        .run(
          'mapped-thread',
          mapped,
          JSON.stringify(thread(mapped, 'mapped-thread')),
        );
      // A row already sitting on the derived id makes the layer rewrite
      // violate its primary key part-way through the migration.
      legacy
        .prepare(
          'INSERT INTO review_layer_sets (worktree_id, revision, layers) VALUES (?, ?, ?)',
        )
        .run(derived, 1, JSON.stringify([]));
      legacy
        .prepare(
          'INSERT INTO review_layer_sets (worktree_id, revision, layers) VALUES (?, ?, ?)',
        )
        .run(mapped, 1, JSON.stringify([]));
    } finally {
      legacy.close();
    }

    // Opening fails rather than half-migrating.
    expect(() => openDatabase(root)).toThrow();

    // And nothing moved: the comment is still on its legacy id, and the
    // tables Git replaces are still there to try again from.
    const after = new DatabaseSync(join(root, 'inventory.sqlite'));
    try {
      expect(
        (
          after
            .prepare('SELECT worktree_id FROM comment_threads WHERE id = ?')
            .get('mapped-thread') as { worktree_id: string }
        ).worktree_id,
      ).toBe(mapped);
      expect(
        after
          .prepare(
            "SELECT name FROM sqlite_master WHERE name IN ('worktrees', 'project_worktrees')",
          )
          .all(),
      ).toHaveLength(2);
    } finally {
      after.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

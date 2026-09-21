import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { CommentRepository } from '../repositories/comment-repository.ts';
import { openDatabase } from './connection.ts';

const migrationsPath = join(import.meta.dirname, '../../drizzle');

async function createLegacyDatabase(directory: string, data: unknown) {
  const databasePath = join(directory, 'inventory.sqlite');
  const database = new DatabaseSync(databasePath);
  try {
    for (const name of ['0000_current-schema.sql', '0001_light_iceman.sql']) {
      const source = await readFile(join(migrationsPath, name), 'utf8');
      database.exec(source);
    }
    database.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);',
    );
    for (const [name, when] of [
      ['0000_current-schema.sql', 1788921607579],
      ['0001_light_iceman.sql', 1789345784383],
    ] as const) {
      const source = await readFile(join(migrationsPath, name), 'utf8');
      const hash = createHash('sha256').update(source).digest('hex');
      database
        .prepare(
          'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        )
        .run(hash, when);
    }
    database
      .prepare(
        'INSERT INTO comment_threads (id, worktree_id, data) VALUES (?, ?, ?)',
      )
      .run('legacy-thread', 'legacy-worktree', JSON.stringify(data));
  } finally {
    database.close();
  }
  return databasePath;
}

async function createPreNormalizationDatabase(
  directory: string,
  thread: { id: string; worktreeId: string },
) {
  const databasePath = join(directory, 'inventory.sqlite');
  const database = new DatabaseSync(databasePath);
  try {
    database.function('porcelain_worktree_id', (_project, _identity) => null);
    const journal = JSON.parse(
      await readFile(join(migrationsPath, 'meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const previous = journal.entries.filter((entry) => entry.idx < 7);
    for (const entry of previous)
      database.exec(
        await readFile(join(migrationsPath, `${entry.tag}.sql`), 'utf8'),
      );
    database.exec(
      'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);',
    );
    for (const entry of previous) {
      const source = await readFile(
        join(migrationsPath, `${entry.tag}.sql`),
        'utf8',
      );
      database
        .prepare(
          'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        )
        .run(createHash('sha256').update(source).digest('hex'), entry.when);
    }
    database
      .prepare(
        'INSERT INTO comment_threads (id, worktree_id, data, revision, last_agent_revision) VALUES (?, ?, ?, 40, 32)',
      )
      .run(thread.id, thread.worktreeId, JSON.stringify(thread));
    database
      .prepare(
        'INSERT INTO comment_reads (worktree_id, seen_through) VALUES (?, 31)',
      )
      .run(thread.worktreeId);
  } finally {
    database.close();
  }
}

it('backfills legacy authors, preserves evidence/order/content and reopens safely', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comment-migration-'));
  const fixedTimestamp = '2026-09-14T01:00:00.000Z';
  const legacy = {
    id: 'legacy-thread',
    worktreeId: 'legacy-worktree',
    anchor: {
      kind: 'codeRange',
      filePath: 'src/legacy.ts',
      startLine: 4,
      endLine: 9,
      side: 'deletions',
      revision: 'commit-revision',
      contentFingerprint: 'content-fingerprint',
    },
    resolved: true,
    messages: [
      { id: 'first', body: 'legacy first' },
      {
        id: 'second',
        body: 'already attributed',
        author: 'agent',
        createdAt: fixedTimestamp,
      },
      { id: 'third', body: 'legacy third' },
    ],
  };
  await createLegacyDatabase(root, legacy);
  try {
    const database = openDatabase(root);
    try {
      const store = new CommentRepository(database.db);
      const expected = {
        ...legacy,
        messages: [
          { id: 'first', body: 'legacy first', author: 'reviewer' },
          {
            id: 'second',
            body: 'already attributed',
            author: 'agent',
            createdAt: fixedTimestamp,
          },
          { id: 'third', body: 'legacy third', author: 'reviewer' },
        ],
        // Threads written before revisions existed are numbered from the
        // sequence they already had, so nothing starts life unacknowledgeable.
        revision: 1,
      };
      expect(store.list('legacy-worktree')).toEqual([expected]);
      expect(store.list('legacy-worktree')[0]?.messages[0]).not.toHaveProperty(
        'createdAt',
      );
      // Every shipped migration ran, counted from what is on disk rather than
      // pinned to a number that any new migration would break.
      const shipped = (await readdir(migrationsPath)).filter((entry) =>
        entry.endsWith('.sql'),
      ).length;
      expect(
        database.db.$client
          .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
          .get(),
      ).toMatchObject({ count: shipped });
    } finally {
      database.close();
    }

    const reopened = openDatabase(root);
    try {
      expect(
        new CommentRepository(reopened.db).list('legacy-worktree'),
      ).toEqual([
        {
          ...legacy,
          messages: [
            { id: 'first', body: 'legacy first', author: 'reviewer' },
            {
              id: 'second',
              body: 'already attributed',
              author: 'agent',
              createdAt: fixedTimestamp,
            },
            { id: 'third', body: 'legacy third', author: 'reviewer' },
          ],
          revision: 1,
        },
      ]);
    } finally {
      reopened.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('normalizes an existing discussion without changing revisions, seen state, or messages', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comment-normalize-'));
  const historical = {
    id: 'historical-thread',
    worktreeId: 'historical-worktree',
    anchor: {
      kind: 'codeRange',
      filePath: 'src/a.ts',
      startLine: 2,
      endLine: 4,
      side: 'deletions',
      contentFingerprint: 'old-fingerprint',
    },
    resolved: true,
    messages: [
      {
        id: 'historical-first',
        body: 'historical text\nwith unicode 🌳',
        author: 'reviewer',
      },
      {
        id: 'historical-agent',
        body: 'agent reply',
        author: 'agent',
        createdAt: '2026-09-19T00:00:00.000Z',
      },
    ],
  };
  await createPreNormalizationDatabase(root, historical);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const database = openDatabase(root);
      try {
        expect(
          new CommentRepository(database.db).list(historical.worktreeId),
        ).toEqual([{ ...historical, revision: 40 }]);
        expect(
          database.db.$client
            .prepare(
              'SELECT last_agent_revision FROM comment_threads WHERE id = ?',
            )
            .get(historical.id),
        ).toEqual({ last_agent_revision: 32 });
        expect(
          database.db.$client
            .prepare(
              'SELECT seen_through FROM comment_reads WHERE worktree_id = ?',
            )
            .get(historical.worktreeId),
        ).toEqual({ seen_through: 31 });
        expect(
          database.db.$client.prepare('PRAGMA foreign_key_check').all(),
        ).toEqual([]);
      } finally {
        database.close();
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rolls back the author backfill when a legacy write is interrupted', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'porcelain-comment-migration-rollback-'),
  );
  const legacy = {
    id: 'legacy-thread',
    worktreeId: 'legacy-worktree',
    anchor: { kind: 'file', filePath: 'README.md' },
    resolved: false,
    messages: [{ id: 'first', body: 'keep this exact body' }],
  };
  const databasePath = await createLegacyDatabase(root, legacy);
  try {
    const database = new DatabaseSync(databasePath);
    database.exec(
      `CREATE TRIGGER stop_comment_author_backfill
       BEFORE UPDATE OF data ON comment_threads
       BEGIN SELECT RAISE(ABORT, 'backfill interrupted'); END;`,
    );
    database.close();

    expect(() => openDatabase(root)).toThrow();

    const unchanged = new DatabaseSync(databasePath);
    try {
      expect(
        unchanged.prepare('SELECT data FROM comment_threads').get(),
      ).toMatchObject({ data: JSON.stringify(legacy) });
      expect(
        unchanged
          .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
          .get(),
      ).toMatchObject({ count: 2 });
    } finally {
      unchanged.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

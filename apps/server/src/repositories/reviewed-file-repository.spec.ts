import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { projectWorktrees } from '../db/schema/project-worktrees.ts';
import { projects } from '../db/schema/projects.ts';
import { worktrees } from '../db/schema/worktrees.ts';
import {
  MAX_REVIEWED_MARKS,
  ReviewedFileRepository,
} from './reviewed-file-repository.ts';

it('stores one durable mark per worktree and keeps rows across database reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-reviewed-files-'));
  const first = openDatabase(directory);
  const projectId = 'project';
  const worktreeId = 'worktree';
  first.db
    .insert(projects)
    .values({
      id: projectId,
      name: 'project',
      commonDirectory: '/fixture/.git',
      repositoryIdentity: 'repository',
      available: true,
      position: 1,
    })
    .run();
  first.db.insert(projectWorktrees).values({ worktreeId, projectId }).run();
  const store = new ReviewedFileRepository(first.db);
  expect(store.hasWorktree(worktreeId)).toBe(true);
  expect(store.hasWorktree('missing')).toBe(false);
  store.set(
    worktreeId,
    'src/file.ts',
    'a'.repeat(64),
    '2026-09-13T00:00:00.000Z',
  );
  store.set(
    worktreeId,
    'src/file.ts',
    'b'.repeat(64),
    '2026-09-13T00:01:00.000Z',
  );
  store.set(
    'other-worktree',
    'src/file.ts',
    'c'.repeat(64),
    '2026-09-13T00:02:00.000Z',
  );
  expect(store.list(worktreeId)).toEqual([
    {
      path: 'src/file.ts',
      fingerprint: 'b'.repeat(64),
      reviewedAt: '2026-09-13T00:01:00.000Z',
    },
  ]);
  // Inventory refresh can replace the active worktree row. Retained project
  // ownership keeps marks available while the checkout is unavailable.
  first.db.delete(worktrees).run();
  expect(store.hasWorktree(worktreeId)).toBe(true);
  expect(store.list(worktreeId)).toHaveLength(1);
  first.close();
  const reopened = openDatabase(directory);
  try {
    expect(new ReviewedFileRepository(reopened.db).list(worktreeId)).toEqual([
      {
        path: 'src/file.ts',
        fingerprint: 'b'.repeat(64),
        reviewedAt: '2026-09-13T00:01:00.000Z',
      },
    ]);
  } finally {
    reopened.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('removes a mark idempotently without affecting another path', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-reviewed-remove-'));
  const database = openDatabase(directory);
  try {
    const store = new ReviewedFileRepository(database.db);
    store.set('worktree', 'a.ts', 'a'.repeat(64), '2026-09-13T00:00:00.000Z');
    store.set('worktree', 'b.ts', 'b'.repeat(64), '2026-09-13T00:00:00.000Z');
    store.remove('worktree', 'missing.ts');
    store.remove('worktree', 'a.ts');
    store.remove('worktree', 'a.ts');
    expect(store.list('worktree')).toEqual([
      {
        path: 'b.ts',
        fingerprint: 'b'.repeat(64),
        reviewedAt: '2026-09-13T00:00:00.000Z',
      },
    ]);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('caps new marks at 2000 by pruning the oldest path, without pruning updates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-reviewed-cap-'));
  const database = openDatabase(directory);
  try {
    const store = new ReviewedFileRepository(database.db);
    for (const index of Array.from({ length: MAX_REVIEWED_MARKS }, (_, i) => i))
      store.set(
        'worktree',
        `file-${String(index).padStart(4, '0')}.ts`,
        'a'.repeat(64),
        '2026-09-13T00:00:00.000Z',
      );
    expect(store.list('worktree')).toHaveLength(MAX_REVIEWED_MARKS);

    store.set('worktree', 'new.ts', 'b'.repeat(64), '2026-09-13T00:01:00.000Z');
    expect(store.list('worktree')).toHaveLength(MAX_REVIEWED_MARKS);
    expect(store.list('worktree')).not.toContainEqual(
      expect.objectContaining({ path: 'file-0000.ts' }),
    );
    expect(store.list('worktree')).toContainEqual(
      expect.objectContaining({ path: 'new.ts', fingerprint: 'b'.repeat(64) }),
    );

    // Updating an existing row changes its evidence but never evicts another
    // reviewed path.
    store.set(
      'worktree',
      'file-0001.ts',
      'c'.repeat(64),
      '2026-09-13T00:02:00.000Z',
    );
    expect(store.list('worktree')).toHaveLength(MAX_REVIEWED_MARKS);
    expect(store.list('worktree')).toContainEqual(
      expect.objectContaining({
        path: 'file-0001.ts',
        fingerprint: 'c'.repeat(64),
      }),
    );

    store.set(
      'worktree',
      'second-new.ts',
      'd'.repeat(64),
      '2026-09-13T00:03:00.000Z',
    );
    expect(store.list('worktree')).toHaveLength(MAX_REVIEWED_MARKS);
    expect(store.list('worktree')).not.toContainEqual(
      expect.objectContaining({ path: 'file-0002.ts' }),
    );
    expect(
      new ReviewedFileRepository(database.db).list('worktree'),
    ).toHaveLength(MAX_REVIEWED_MARKS);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

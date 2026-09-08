import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { commentStorageSize } from '../models/comment-storage-size.ts';
import type { CommentThread } from '../models/comment-thread.ts';
import type { Project } from '../models/project.ts';
import { CommentRepository } from './comment-repository.ts';
import { InventoryRepository } from './inventory-repository.ts';

it('retains creation order and discussions after inventory removes their worktree rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comment-storage-'));
  const database = openDatabase(root);
  try {
    const inventory = new InventoryRepository(database.db);
    const project: Project = {
      id: 'project',
      name: 'project',
      commonDirectory: '/git',
      repositoryIdentity: 'identity',
      available: true,
      worktrees: [
        {
          id: 'worktree',
          path: '/repo',
          metadataIdentity: 'metadata',
          main: true,
          branch: 'main',
          available: true,
        },
      ],
    };
    inventory.save(project);
    const store = new CommentRepository(database.db);
    const first: CommentThread = {
      id: 'z-first',
      worktreeId: 'worktree',
      anchor: { kind: 'file', filePath: 'a.ts' },
      resolved: false,
      messages: [{ id: 'message', body: 'initial 界\n"quoted"' }],
    };
    const second = { ...first, id: 'a-second' };
    store.save(first);
    store.save(second);
    store.save({ ...first, resolved: true });
    expect(store.find('worktree', first.id)).toEqual({
      ...first,
      resolved: true,
    });
    expect(store.find('other', first.id)).toBeUndefined();
    expect(store.usage('worktree')).toEqual({
      threads: 2,
      bytes: commentStorageSize(first) + commentStorageSize(second),
    });
    expect(store.usage('other')).toEqual({ threads: 0, bytes: 0 });
    inventory.save({ ...project, worktrees: [] });
    expect(inventory.read().projects[0]?.worktrees).toEqual([]);
    expect(store.list('worktree')).toEqual([
      { ...first, resolved: true },
      second,
    ]);
    expect(store.list('other')).toEqual([]);
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

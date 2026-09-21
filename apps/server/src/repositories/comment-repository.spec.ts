import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { commentStorageSize } from '../models/comment-storage-size.ts';
import type { CommentThread } from '../models/comment-thread.ts';
import type { RegisteredProject } from '../models/project.ts';
import { CommentIdentityConflictError } from '../use-cases/errors/comment-identity-conflict-error.ts';
import { CommentRepository } from './comment-repository.ts';
import { InventoryRepository } from './inventory-repository.ts';

it('retains creation order and discussions after inventory removes their worktree rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-comment-storage-'));
  const database = openDatabase(root);
  try {
    const inventory = new InventoryRepository(database.db);
    const project: RegisteredProject = {
      id: 'project',
      name: 'project',
      namedByOwner: false,
      commonDirectory: '/git',
      repositoryIdentity: 'identity',
      available: true,
    };
    inventory.save(project);
    const store = new CommentRepository(database.db);
    const first: CommentThread = {
      id: 'z-first',
      worktreeId: 'worktree',
      anchor: { kind: 'file', filePath: 'a.ts' },
      resolved: false,
      messages: [
        {
          id: 'message',
          body: 'initial 界\n"quoted"',
          author: 'reviewer',
          createdAt: '2026-09-14T00:00:00.000Z',
        },
      ],
    };
    const firstMessage = first.messages[0];
    if (!firstMessage) throw new Error('Expected the fixture message');
    const second = {
      ...first,
      id: 'a-second',
      messages: [{ ...firstMessage, id: 'second-message' }],
    };
    const secondMessage = second.messages[0];
    if (!secondMessage) throw new Error('Expected the second fixture message');
    store.create(first);
    store.create(second);
    // Every retained write advances the discussion revision the owner sees.
    expect(store.resolve('worktree', first.id, true)).toMatchObject({
      revision: 3,
    });
    expect(store.create(first)).toMatchObject({
      id: first.id,
      resolved: true,
      revision: 3,
    });
    expect(() => store.create({ ...first, worktreeId: 'other' })).toThrow(
      CommentIdentityConflictError,
    );
    expect(() =>
      store.reply('worktree', second.id, {
        ...secondMessage,
        id: firstMessage.id,
      }),
    ).toThrow(CommentIdentityConflictError);
    expect(() =>
      store.reply('worktree', first.id, {
        ...firstMessage,
        author: 'agent',
      }),
    ).toThrow(CommentIdentityConflictError);
    expect(store.find('worktree', first.id)).toEqual({
      ...first,
      resolved: true,
      revision: 3,
    });
    expect(store.find('other', first.id)).toBeUndefined();
    expect(store.usage('worktree')).toEqual({
      threads: 2,
      bytes:
        commentStorageSize({ ...first, resolved: true }) +
        commentStorageSize(second),
    });
    expect(store.usage('other')).toEqual({ threads: 0, bytes: 0 });
    // Threads are keyed by worktree id and owe nothing to the project record:
    // storage keeps them whether or not Git still lists that worktree.
    expect(store.list('worktree')).toEqual([
      { ...first, resolved: true, revision: 3 },
      { ...second, revision: 2 },
    ]);
    expect(store.list('other')).toEqual([]);
  } finally {
    database.close();
    await rm(root, { recursive: true, force: true });
  }
});

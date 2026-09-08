import { expect, it } from 'vitest';
import type { CommentThread } from '../models/comment-thread.ts';
import type { Inventory } from '../models/inventory.ts';
import type { CommentStore } from '../repositories/interfaces/comment-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { CommentThreads } from './comment-threads.ts';
import { CommentTargetNotFoundError } from './errors/comment-target-not-found-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

class MemoryComments implements CommentStore {
  readonly rows = new Map<string, CommentThread>();
  list(worktreeId: string) {
    return structuredClone(
      [...this.rows.values()].filter((row) => row.worktreeId === worktreeId),
    );
  }
  save(thread: CommentThread) {
    this.rows.set(thread.id, structuredClone(thread));
  }
}
class MemoryInventory implements InventoryStore {
  readonly state: Inventory = {
    environmentId: 'environment',
    projects: [
      {
        id: 'project',
        name: 'project',
        commonDirectory: '/git',
        repositoryIdentity: 'repository',
        available: false,
        worktrees: [
          {
            id: 'worktree',
            path: '/checkout',
            metadataIdentity: null,
            main: true,
            branch: null,
            available: false,
          },
        ],
      },
    ],
  };
  read() {
    return this.state;
  }
  save() {
    throw new Error('Comments must not modify inventory');
  }
}
it('preserves literal anchors and reply order, isolates scope, and sets resolution idempotently', () => {
  const store = new MemoryComments();
  const inventory = new MemoryInventory();
  let sequence = 0;
  const comments = new CommentThreads(store, inventory, () =>
    String(++sequence),
  );
  expect(comments.execute({ kind: 'list', worktreeId: 'worktree' })).toEqual(
    [],
  );
  const anchor = {
    kind: 'codeRange' as const,
    filePath: 'src/a.ts',
    startLine: 2,
    endLine: 5,
    revision: 'immutable',
    contentFingerprint: 'opaque',
  };
  const [thread] = comments.execute({
    kind: 'create',
    worktreeId: 'worktree',
    anchor,
    body: '  original\n',
  });
  if (!thread) throw new Error('Expected thread');
  anchor.startLine = 99;
  comments.execute({
    kind: 'reply',
    worktreeId: 'worktree',
    threadId: thread.id,
    body: 'first',
  });
  const resolved = comments.execute({
    kind: 'resolve',
    worktreeId: 'worktree',
    threadId: thread.id,
    resolved: true,
  });
  expect(
    comments.execute({
      kind: 'resolve',
      worktreeId: 'worktree',
      threadId: thread.id,
      resolved: true,
    }),
  ).toEqual(resolved);
  comments.execute({
    kind: 'reply',
    worktreeId: 'worktree',
    threadId: thread.id,
    body: 'second',
  });
  inventory.state.projects = [];
  const [retained] = comments.execute({ kind: 'list', worktreeId: 'worktree' });
  expect(retained).toMatchObject({
    resolved: true,
    anchor: {
      startLine: 2,
      revision: 'immutable',
      contentFingerprint: 'opaque',
    },
    messages: [
      { id: '2', body: '  original\n' },
      { id: '3', body: 'first' },
      { id: '4', body: 'second' },
    ],
  });
  expect(
    comments.execute({
      kind: 'resolve',
      worktreeId: 'worktree',
      threadId: thread.id,
      resolved: false,
    })[0]?.resolved,
  ).toBe(false);
  expect(() => comments.execute({ kind: 'list', worktreeId: 'other' })).toThrow(
    WorktreeNotFoundError,
  );
  expect(() =>
    comments.execute({
      kind: 'reply',
      worktreeId: 'other',
      threadId: thread.id,
      body: 'no',
    }),
  ).toThrow(CommentTargetNotFoundError);
  expect(() =>
    comments.execute({
      kind: 'create',
      worktreeId: 'worktree',
      anchor,
      body: 'no',
    }),
  ).toThrow(CommentTargetNotFoundError);
});

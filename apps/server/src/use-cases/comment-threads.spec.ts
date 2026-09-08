import { expect, it } from 'vitest';
import { commentStorageSize } from '../models/comment-storage-size.ts';
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
  find(worktreeId: string, threadId: string) {
    const thread = this.rows.get(threadId);
    return thread?.worktreeId === worktreeId
      ? structuredClone(thread)
      : undefined;
  }
  usage(worktreeId: string) {
    const rows = [...this.rows.values()].filter(
      (row) => row.worktreeId === worktreeId,
    );
    return {
      threads: rows.length,
      bytes: rows.reduce((sum, row) => sum + commentStorageSize(row), 0),
    };
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
  const originalMessageId = thread.messages[0]?.id;
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
      { id: originalMessageId, body: '  original\n' },
      { id: resolved[0]?.messages[1]?.id, body: 'first' },
      { body: 'second' },
    ],
  });
  expect(new Set(retained?.messages.map((message) => message.id)).size).toBe(3);
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
      anchor: { ...anchor, startLine: 2 },
      body: 'no',
    }),
  ).toThrow(CommentTargetNotFoundError);
});

it('bounds thread and message additions without blocking resolution at capacity or reading all threads', () => {
  const store = new MemoryComments();
  const inventory = new MemoryInventory();
  let id = 0;
  const comments = new CommentThreads(store, inventory, () => String(++id));
  const create = {
    kind: 'create' as const,
    worktreeId: 'worktree',
    anchor: { kind: 'file' as const, filePath: 'a' },
    body: 'text',
  };
  const [first] = comments.execute(create);
  if (!first) throw new Error('Missing thread');
  store.list = () => {
    throw new Error('Mutations must not load all threads');
  };
  for (let count = 1; count < 100; count++) comments.execute(create);
  expect(() => comments.execute(create)).toThrow('Comment capacity exceeded');
  for (let count = 1; count < 100; count++)
    comments.execute({
      kind: 'reply',
      worktreeId: 'worktree',
      threadId: first.id,
      body: 'reply',
    });
  const before = structuredClone(store.rows);
  expect(() =>
    comments.execute({
      kind: 'reply',
      worktreeId: 'worktree',
      threadId: first.id,
      body: 'overflow',
    }),
  ).toThrow('Comment capacity exceeded');
  expect(store.rows).toEqual(before);
  for (const resolved of [true, false])
    expect(
      comments.execute({
        kind: 'resolve',
        worktreeId: 'worktree',
        threadId: first.id,
        resolved,
      })[0]?.resolved,
    ).toBe(resolved);
});

it('enforces the UTF-8 serialized aggregate budget and allows resolution at exactly one MiB', () => {
  const store = new MemoryComments();
  const inventory = new MemoryInventory();
  const thread: CommentThread = {
    id: 'thread',
    worktreeId: 'worktree',
    anchor: { kind: 'file', filePath: 'a' },
    resolved: false,
    messages: [],
  };
  // Build a valid retained thread at the exact byte limit, including JSON overhead.
  while (commentStorageSize(thread) < 1048576) {
    const message = { id: String(thread.messages.length), body: '' };
    thread.messages.push(message);
    const remaining = 1048576 - commentStorageSize(thread);
    message.body = 'x'.repeat(Math.min(16000, remaining));
  }
  store.save(thread);
  const comments = new CommentThreads(store, inventory, () => 'new-id');
  expect(store.usage('worktree').bytes).toBe(1048576);
  expect(thread.messages.length).toBeLessThan(100);
  expect(() =>
    comments.execute({
      kind: 'reply',
      worktreeId: 'worktree',
      threadId: thread.id,
      body: '界',
    }),
  ).toThrow('Comment capacity exceeded');
  expect(() =>
    comments.execute({
      kind: 'create',
      worktreeId: 'worktree',
      anchor: { kind: 'file', filePath: 'b' },
      body: 'x',
    }),
  ).toThrow('Comment capacity exceeded');
  expect(store.find('worktree', thread.id)).toEqual(thread);
  for (const resolved of [true, false])
    comments.execute({
      kind: 'resolve',
      worktreeId: 'worktree',
      threadId: thread.id,
      resolved,
    });
  expect(store.find('worktree', thread.id)).toEqual(thread);
  expect(
    commentStorageSize({ ...thread, messages: [{ id: '1', body: '界' }] }) -
      commentStorageSize({ ...thread, messages: [{ id: '1', body: 'x' }] }),
  ).toBe(2);
});

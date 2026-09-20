import { expect, it } from 'vitest';

const reviewer = { kind: 'viewer', deviceId: null } as const;
const agent = { kind: 'agent' } as const;

import { commentStorageSize } from '../models/comment-storage-size.ts';
import type { CommentThread } from '../models/comment-thread.ts';
import type { CommentStore } from '../repositories/interfaces/comment-store.ts';
import { CommentThreads } from './comment-threads.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { fakeWorktrees } from './helpers/fake-worktrees.ts';

class MemoryComments implements CommentStore {
  // The thread and its revision are kept apart, as the table keeps them: only
  // the thread is stored data, so only the thread counts against the budget.
  readonly rows = new Map<
    string,
    { thread: CommentThread; revision: number }
  >();
  private revision = 0;
  get threads() {
    return new Map(
      [...this.rows].map(([id, row]) => [id, row.thread] as const),
    );
  }
  list(worktreeId: string) {
    return [...this.rows.values()]
      .filter((row) => row.thread.worktreeId === worktreeId)
      .map((row) => ({
        ...structuredClone(row.thread),
        revision: row.revision,
      }));
  }
  find(worktreeId: string, threadId: string) {
    const row = this.rows.get(threadId);
    return row?.thread.worktreeId === worktreeId
      ? { ...structuredClone(row.thread), revision: row.revision }
      : undefined;
  }
  usage(worktreeId: string) {
    const rows = [...this.rows.values()].filter(
      (row) => row.thread.worktreeId === worktreeId,
    );
    return {
      threads: rows.length,
      bytes: rows.reduce((sum, row) => sum + commentStorageSize(row.thread), 0),
    };
  }
  save(thread: CommentThread) {
    this.revision += 1;
    const stored = structuredClone(thread);
    this.rows.set(thread.id, { thread: stored, revision: this.revision });
    return { ...structuredClone(stored), revision: this.revision };
  }
}
/**
 * The worktree these comments belong to, unreachable on purpose: a review
 * conversation must survive an unplugged disk, so comments ask whether the
 * worktree is *known*, not whether its checkout can be read.
 */
const worktrees = () =>
  fakeWorktrees(
    [
      {
        id: 'worktree',
        path: '/checkout',
        metadataIdentity: 'identity',
        main: true,
        available: false,
      },
    ],
    { projectAvailable: false },
  );
it('preserves literal anchors and reply order, isolates scope, and sets resolution idempotently', async () => {
  const store = new MemoryComments();
  let sequence = 0;
  const comments = new CommentThreads(store, worktrees(), () =>
    String(++sequence),
  );
  expect(
    await comments.execute({ kind: 'list', worktreeId: 'worktree' }, reviewer),
  ).toEqual([]);
  const anchor = {
    kind: 'codeRange' as const,
    filePath: 'src/a.ts',
    startLine: 2,
    endLine: 5,
    revision: 'immutable',
    contentFingerprint: 'opaque',
    side: 'deletions' as const,
  };
  const [thread] = await comments.execute(
    {
      kind: 'create',
      worktreeId: 'worktree',
      anchor,
      body: '  original\n',
    },
    agent,
  );
  if (!thread) throw new Error('Expected thread');
  const originalMessageId = thread.messages[0]?.id;
  anchor.startLine = 99;
  await comments.execute(
    {
      kind: 'reply',
      worktreeId: 'worktree',
      threadId: thread.id,
      body: 'first',
    },
    reviewer,
  );
  const resolved = await comments.execute(
    {
      kind: 'resolve',
      worktreeId: 'worktree',
      threadId: thread.id,
      resolved: true,
    },
    reviewer,
  );
  expect(
    await comments.execute(
      {
        kind: 'resolve',
        worktreeId: 'worktree',
        threadId: thread.id,
        resolved: true,
      },
      reviewer,
    ),
  ).toEqual(resolved);
  await comments.execute(
    {
      kind: 'reply',
      worktreeId: 'worktree',
      threadId: thread.id,
      body: 'second',
    },
    agent,
  );
  const [retained] = await comments.execute(
    { kind: 'list', worktreeId: 'worktree' },
    reviewer,
  );
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
    (
      await comments.execute(
        {
          kind: 'resolve',
          worktreeId: 'worktree',
          threadId: thread.id,
          resolved: false,
        },
        reviewer,
      )
    )[0]?.resolved,
  ).toBe(false);
  await expect(
    comments.execute({ kind: 'list', worktreeId: 'other' }, reviewer),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  // A reply aimed at a worktree that does not exist is refused for that
  // reason, rather than looking like a missing thread: every surface asks the
  // same question about a worktree and gets the same answer. Both are 404.
  await expect(
    comments.execute(
      {
        kind: 'reply',
        worktreeId: 'other',
        threadId: thread.id,
        body: 'no',
      },
      reviewer,
    ),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  // Once Git stops listing the worktree, nothing may be written to it and
  // nothing may be read from it — but the threads are not deleted here. They
  // wait for the thirty-day rule, which is the only thing allowed to remove
  // them, and only after a listing that worked said the worktree was gone.
  const gone = new CommentThreads(store, fakeWorktrees([]), () => 'unused');
  const stored = structuredClone(store.rows);
  await expect(
    gone.execute(
      {
        kind: 'create',
        worktreeId: 'worktree',
        anchor: { ...anchor, startLine: 2 },
        body: 'no',
      },
      reviewer,
    ),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  await expect(
    gone.execute({ kind: 'list', worktreeId: 'worktree' }, reviewer),
  ).rejects.toBeInstanceOf(WorktreeNotFoundError);
  expect(store.rows).toEqual(stored);
});

it('bounds thread and message additions without blocking resolution at capacity or reading all threads', async () => {
  const store = new MemoryComments();
  let id = 0;
  const comments = new CommentThreads(store, worktrees(), () => String(++id));
  const create = {
    kind: 'create' as const,
    worktreeId: 'worktree',
    anchor: { kind: 'file' as const, filePath: 'a' },
    body: 'text',
  };
  const [first] = await comments.execute(create, reviewer);
  if (!first) throw new Error('Missing thread');
  store.list = () => {
    throw new Error('Mutations must not load all threads');
  };
  for (let count = 1; count < 100; count++)
    await comments.execute(create, reviewer);
  await expect(comments.execute(create, reviewer)).rejects.toThrow(
    'Comment capacity exceeded',
  );
  for (let count = 1; count < 100; count++)
    await comments.execute(
      {
        kind: 'reply',
        worktreeId: 'worktree',
        threadId: first.id,
        body: 'reply',
      },
      reviewer,
    );
  const before = structuredClone(store.rows);
  await expect(
    comments.execute(
      {
        kind: 'reply',
        worktreeId: 'worktree',
        threadId: first.id,
        body: 'overflow',
      },
      reviewer,
    ),
  ).rejects.toThrow('Comment capacity exceeded');
  expect(store.rows).toEqual(before);
  for (const resolved of [true, false])
    expect(
      (
        await comments.execute(
          {
            kind: 'resolve',
            worktreeId: 'worktree',
            threadId: first.id,
            resolved,
          },
          reviewer,
        )
      )[0]?.resolved,
    ).toBe(resolved);
});

it('enforces the UTF-8 serialized aggregate budget and allows resolution at exactly one MiB', async () => {
  const store = new MemoryComments();
  const thread: CommentThread = {
    id: 'thread',
    worktreeId: 'worktree',
    anchor: { kind: 'file', filePath: 'a' },
    resolved: false,
    messages: [],
  };
  // Build a valid retained thread at the exact byte limit, including JSON overhead.
  while (commentStorageSize(thread) < 1048576) {
    const message = {
      id: String(thread.messages.length),
      body: '',
      author: 'reviewer' as const,
    };
    thread.messages.push(message);
    const remaining = 1048576 - commentStorageSize(thread);
    message.body = 'x'.repeat(Math.min(16000, remaining));
  }
  store.save(thread);
  const comments = new CommentThreads(store, worktrees(), () => 'new-id');
  expect(store.usage('worktree').bytes).toBe(1048576);
  expect(thread.messages.length).toBeLessThan(100);
  await expect(
    comments.execute(
      {
        kind: 'reply',
        worktreeId: 'worktree',
        threadId: thread.id,
        body: '界',
      },
      reviewer,
    ),
  ).rejects.toThrow('Comment capacity exceeded');
  await expect(
    comments.execute(
      {
        kind: 'create',
        worktreeId: 'worktree',
        anchor: { kind: 'file', filePath: 'b' },
        body: 'x',
      },
      reviewer,
    ),
  ).rejects.toThrow('Comment capacity exceeded');
  expect(store.find('worktree', thread.id)).toEqual({
    ...thread,
    revision: expect.any(Number),
  });
  for (const resolved of [true, false])
    await comments.execute(
      {
        kind: 'resolve',
        worktreeId: 'worktree',
        threadId: thread.id,
        resolved,
      },
      reviewer,
    );
  expect(store.find('worktree', thread.id)).toEqual({
    ...thread,
    revision: expect.any(Number),
  });
  expect(
    commentStorageSize({
      ...thread,
      messages: [{ id: '1', body: '界', author: 'reviewer' }],
    }) -
      commentStorageSize({
        ...thread,
        messages: [{ id: '1', body: 'x', author: 'reviewer' }],
      }),
  ).toBe(2);
});

it('preserves comparison targets through storage and rejects mutable commit anchors', async () => {
  const store = new MemoryComments();
  const comments = new CommentThreads(store, worktrees(), () => 'new-id');
  const anchor = {
    kind: 'codeRange' as const,
    filePath: 'a.ts',
    startLine: 2,
    endLine: 5,
    side: 'deletions' as const,
    comparison: { kind: 'commit' as const, parent: 2 },
    revision: 'a'.repeat(40),
  };
  await comments.execute(
    {
      kind: 'create',
      worktreeId: 'worktree',
      body: 'Second parent',
      anchor,
    },
    reviewer,
  );
  expect(
    (
      await comments.execute({ kind: 'list', worktreeId: 'worktree' }, reviewer)
    )[0]?.anchor,
  ).toEqual(anchor);
  await expect(
    comments.execute(
      {
        kind: 'create',
        worktreeId: 'worktree',
        body: 'Invalid',
        anchor: { ...anchor, revision: 'HEAD' },
      },
      reviewer,
    ),
  ).rejects.toThrow();
  expect(store.list('worktree')).toHaveLength(1);
});

it('takes authorship from the principal, never from the command', async () => {
  const store = new MemoryComments();
  let id = 0;
  const comments = new CommentThreads(store, worktrees(), () => String(++id));
  const create = {
    kind: 'create' as const,
    worktreeId: 'worktree',
    anchor: { kind: 'file' as const, filePath: 'a.ts' },
    body: 'text',
  };
  // The owner works through the same door a paired viewer does.
  for (const [principal, author] of [
    [reviewer, 'reviewer'],
    [{ kind: 'owner' } as const, 'reviewer'],
    [agent, 'agent'],
  ] as const) {
    const [thread] = await comments.execute(create, principal);
    expect(thread?.messages[0]?.author).toBe(author);
    if (!thread) throw new Error('Missing thread');
    const [replied] = await comments.execute(
      { kind: 'reply', worktreeId: 'worktree', threadId: thread.id, body: 'r' },
      principal,
    );
    expect(replied?.messages[1]?.author).toBe(author);
  }
});

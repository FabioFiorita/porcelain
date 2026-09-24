import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdSource } from '@porcelain/kernel/fakes';
import {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
} from '@porcelain/reviews/errors';
import type {
  CommentAnchor,
  CreateCommentThreadInput,
} from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { CreateCommentThreadService } from './create-comment-thread-service.ts';

const worktreeId = 'a'.repeat(64);
const limits = {
  threadsPerWorktree: 100,
  messagesPerThread: 100,
  bytesPerWorktree: 1024 * 1024,
};

function setup() {
  const store = new InMemoryCommentStore();
  const service = new CreateCommentThreadService(
    store,
    new SequentialIdSource(),
    new FixedClock(),
    limits,
  );
  return { store, service };
}

function input(
  overrides: Partial<CreateCommentThreadInput> = {},
): CreateCommentThreadInput {
  return {
    worktreeId,
    anchor: { kind: 'file', filePath: 'README.md' },
    body: 'Looks good',
    writer: { kind: 'device' },
    ...overrides,
  };
}

describe('CreateCommentThreadService', () => {
  it('opens an unresolved thread with one message and the next revision', () => {
    const { service, store } = setup();
    const thread = service.execute(input());
    expect(thread).toMatchObject({
      worktreeId,
      resolved: false,
      revision: 1,
      messages: [{ body: 'Looks good', author: 'reviewer' }],
    });
    expect(store.list({ worktreeId })).toEqual([thread]);
  });

  it('writes as the agent only when the writer is the agent', () => {
    const { service } = setup();
    expect(
      service.execute(input({ writer: { kind: 'agent' } })).messages[0]?.author,
    ).toBe('agent');
    expect(
      service.execute(input({ writer: { kind: 'owner' } })).messages[0]?.author,
    ).toBe('reviewer');
  });

  it('numbers revisions across worktrees', () => {
    const { service } = setup();
    service.execute(input());
    expect(
      service.execute(input({ worktreeId: 'b'.repeat(64) })).revision,
    ).toBe(2);
  });

  it('answers a retried create with the original thread and stores nothing new', () => {
    const { service, store } = setup();
    const ids = { threadId: 'thread-1', messageId: 'message-1' };
    const first = service.execute(input(ids));
    const again = service.execute(
      input({
        ...ids,
        anchor: { filePath: 'README.md', kind: 'file' },
      }),
    );
    expect(again).toEqual(first);
    expect(store.list({ worktreeId })).toHaveLength(1);
  });

  const ids = { threadId: 'thread-1', messageId: 'message-1' };
  it.each([
    {
      name: 'different content',
      attempt: input({ ...ids, body: 'Something else' }),
    },
    {
      name: 'another anchor',
      attempt: input({
        ...ids,
        anchor: { kind: 'file', filePath: 'OTHER.md' },
      }),
    },
    {
      name: 'another worktree',
      attempt: input({ ...ids, worktreeId: 'b'.repeat(64) }),
    },
    {
      name: 'another writer',
      attempt: input({ ...ids, writer: { kind: 'agent' } }),
    },
    {
      name: 'another message id',
      attempt: input({ ...ids, messageId: 'message-2' }),
    },
  ])('refuses a thread id reused for $name', ({ attempt }) => {
    const { service } = setup();
    service.execute(input(ids));
    expect(() => service.execute(attempt)).toThrow(
      CommentIdentityConflictError,
    );
  });

  it('refuses a new thread whose message id already belongs to another thread', () => {
    const { service } = setup();
    service.execute(input({ threadId: 'thread-1', messageId: 'message-1' }));
    expect(() =>
      service.execute(input({ threadId: 'thread-2', messageId: 'message-1' })),
    ).toThrow(CommentIdentityConflictError);
  });

  it('refuses a code range that ends before it starts and stores nothing', () => {
    const { service, store } = setup();
    expect(() =>
      service.execute(
        input({
          anchor: {
            kind: 'codeRange',
            filePath: 'README.md',
            startLine: 3,
            endLine: 2,
          },
        }),
      ),
    ).toThrow(InvalidLineRangeError);
    expect(store.list({ worktreeId })).toEqual([]);
  });

  it('opens a thread on a one-line code range', () => {
    const { service } = setup();
    expect(
      service.execute(
        input({
          anchor: {
            kind: 'codeRange',
            filePath: 'README.md',
            startLine: 3,
            endLine: 3,
          },
        }),
      ).anchor,
    ).toMatchObject({ startLine: 3, endLine: 3 });
  });

  it.each<{ name: string; anchor: CommentAnchor }>([
    {
      name: 'a commit comparison without an object id',
      anchor: {
        kind: 'file',
        filePath: 'README.md',
        comparison: { kind: 'commit', parent: 1 },
        revision: 'main',
      },
    },
    {
      name: 'a file comparison with a revision',
      anchor: {
        kind: 'file',
        filePath: 'README.md',
        comparison: { kind: 'file' },
        revision: 'a'.repeat(40),
      },
    },
  ])('refuses $name and stores nothing', ({ anchor }) => {
    const { service, store } = setup();
    expect(() => service.execute(input({ anchor }))).toThrow(
      CommentRevisionMismatchError,
    );
    expect(store.list({ worktreeId })).toEqual([]);
  });

  it('opens a thread on a commit comparison that names its object id', () => {
    const { service } = setup();
    const anchor: CommentAnchor = {
      kind: 'file',
      filePath: 'README.md',
      comparison: { kind: 'commit', parent: 1 },
      revision: 'a'.repeat(40),
    };
    expect(service.execute(input({ anchor })).anchor).toEqual(anchor);
  });

  it('opens the hundredth thread of a worktree and refuses the next', () => {
    const { service, store } = setup();
    for (let index = 0; index < 100; index += 1) service.execute(input());
    expect(store.list({ worktreeId })).toHaveLength(100);
    expect(() => service.execute(input())).toThrow(CommentLimitExceededError);
    expect(() =>
      service.execute(input({ worktreeId: 'b'.repeat(64) })),
    ).not.toThrow();
  });

  it('refuses a thread that would take the worktree past one mebibyte', () => {
    const { service, store } = setup();
    const body = 'x'.repeat(15_000);
    let created = 0;
    let refused: unknown;
    while (refused === undefined && created < 100) {
      try {
        service.execute(input({ body }));
        created += 1;
      } catch (error) {
        refused = error;
      }
    }
    expect(refused).toBeInstanceOf(CommentLimitExceededError);
    expect(store.usage({ worktreeId }).bytes).toBeLessThanOrEqual(1024 * 1024);
    expect(store.usage({ worktreeId }).bytes + 15_000).toBeGreaterThan(
      1024 * 1024,
    );
    expect(store.list({ worktreeId })).toHaveLength(created);
  });
});

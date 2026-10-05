import { IdSource, Clock } from '@porcelain/kernel/ports';
import {
  CommentStore,
  CreateCommentThreadOptions,
} from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdSource } from '@porcelain/kernel/fakes';
import {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentRevisionMismatchError,
  UnsupportedCommentComparisonError,
} from '@porcelain/reviews/errors';
import {
  type CommentAnchor,
  type CreateCommentThreadInput,
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
  const service = Effect.runSync(
    CreateCommentThreadService.pipe(
      Effect.provide(CreateCommentThreadService.layer),
      Effect.provideService(CommentStore, store),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(Clock, new FixedClock()),
      Effect.provideService(CreateCommentThreadOptions, limits),
    ),
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
    const thread = Effect.runSync(service.execute(input()));
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
      Effect.runSync(service.execute(input({ writer: { kind: 'agent' } })))
        .messages[0]?.author,
    ).toBe('agent');
    expect(
      Effect.runSync(service.execute(input({ writer: { kind: 'owner' } })))
        .messages[0]?.author,
    ).toBe('reviewer');
  });

  it('numbers revisions across worktrees', () => {
    const { service } = setup();
    Effect.runSync(service.execute(input()));
    expect(
      Effect.runSync(service.execute(input({ worktreeId: 'b'.repeat(64) })))
        .revision,
    ).toBe(2);
  });

  it('answers a retried create with the original thread and stores nothing new', () => {
    const { service, store } = setup();
    const ids = { threadId: 'thread-1', messageId: 'message-1' };
    const first = Effect.runSync(service.execute(input(ids)));
    const again = Effect.runSync(
      service.execute(
        input({
          ...ids,
          anchor: { filePath: 'README.md', kind: 'file' },
        }),
      ),
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
    Effect.runSync(service.execute(input(ids)));
    expect(() => Effect.runSync(service.execute(attempt))).toThrow(
      CommentIdentityConflictError,
    );
  });

  it('answers a repeated branch comment and refuses the same id against another base', () => {
    const { service } = setup();
    const onBase = (base: string) =>
      input({
        ...ids,
        anchor: {
          kind: 'file',
          filePath: 'README.md',
          comparison: { kind: 'branch', base },
          revision: 'a'.repeat(40),
        },
      });
    const first = Effect.runSync(service.execute(onBase('refs/heads/main')));
    expect(Effect.runSync(service.execute(onBase('refs/heads/main')))).toEqual(
      first,
    );
    expect(() =>
      Effect.runSync(service.execute(onBase('refs/heads/develop'))),
    ).toThrow(CommentIdentityConflictError);
  });

  it('refuses a new thread whose message id already belongs to another thread', () => {
    const { service } = setup();
    Effect.runSync(
      service.execute(input({ threadId: 'thread-1', messageId: 'message-1' })),
    );
    expect(() =>
      Effect.runSync(
        service.execute(
          input({ threadId: 'thread-2', messageId: 'message-1' }),
        ),
      ),
    ).toThrow(CommentIdentityConflictError);
  });

  it('refuses a code range that ends before it starts and stores nothing', () => {
    const { service, store } = setup();
    expect(() =>
      Effect.runSync(
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
      ),
    ).toThrow(InvalidLineRangeError);
    expect(store.list({ worktreeId })).toEqual([]);
  });

  it('opens a thread on a one-line code range', () => {
    const { service } = setup();
    expect(
      Effect.runSync(
        service.execute(
          input({
            anchor: {
              kind: 'codeRange',
              filePath: 'README.md',
              startLine: 3,
              endLine: 3,
            },
          }),
        ),
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
      name: 'a branch comparison without the tip it was read at',
      anchor: {
        kind: 'codeRange',
        filePath: 'README.md',
        startLine: 1,
        endLine: 2,
        side: 'additions',
        comparison: { kind: 'branch', base: 'refs/heads/main' },
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
    expect(() => Effect.runSync(service.execute(input({ anchor })))).toThrow(
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
    expect(Effect.runSync(service.execute(input({ anchor }))).anchor).toEqual(
      anchor,
    );
  });

  it('opens a thread on a branch comparison that names the tip it was read at', () => {
    const { service } = setup();
    const anchor: CommentAnchor = {
      kind: 'codeRange',
      filePath: 'README.md',
      startLine: 1,
      endLine: 2,
      side: 'additions',
      comparison: { kind: 'branch', base: 'refs/remotes/origin/main' },
      revision: 'a'.repeat(40),
      contentFingerprint: 'f'.repeat(64),
    };
    expect(Effect.runSync(service.execute(input({ anchor }))).anchor).toEqual(
      anchor,
    );
  });

  it('opens a thread on the whole working-tree change', () => {
    const { service, store } = setup();
    const thread = Effect.runSync(
      service.execute(input({ anchor: { kind: 'change' } })),
    );
    expect(thread.anchor).toEqual({ kind: 'change' });
    expect(store.list({ worktreeId })).toEqual([thread]);
  });

  it('opens a thread on the whole branch change read at its tip', () => {
    const { service } = setup();
    const anchor: CommentAnchor = {
      kind: 'change',
      comparison: { kind: 'branch', base: 'refs/heads/main' },
      revision: 'a'.repeat(40),
    };
    expect(Effect.runSync(service.execute(input({ anchor }))).anchor).toEqual(
      anchor,
    );
  });

  it('refuses a whole-branch comment that does not name the tip it was read at', () => {
    const { service, store } = setup();
    expect(() =>
      Effect.runSync(
        service.execute(
          input({
            anchor: {
              kind: 'change',
              comparison: { kind: 'branch', base: 'refs/heads/main' },
            },
          }),
        ),
      ),
    ).toThrow(CommentRevisionMismatchError);
    expect(store.list({ worktreeId })).toEqual([]);
  });

  it.each<[string, CommentAnchor]>([
    ['a file', { kind: 'change', comparison: { kind: 'file' } }],
    [
      'a commit',
      {
        kind: 'change',
        comparison: { kind: 'commit', parent: 1 },
        revision: 'a'.repeat(40),
      },
    ],
    [
      'a worktree scope',
      { kind: 'change', comparison: { kind: 'worktree', scope: 'staged' } },
    ],
  ])(
    'refuses a whole-change comment against %s and stores nothing',
    (_, anchor) => {
      const { service, store } = setup();
      expect(() => Effect.runSync(service.execute(input({ anchor })))).toThrow(
        UnsupportedCommentComparisonError,
      );
      expect(store.list({ worktreeId })).toEqual([]);
    },
  );

  it('answers a repeated whole-change comment and refuses the same id on a file', () => {
    const { service } = setup();
    const ids = { threadId: 'thread-1', messageId: 'message-1' };
    const first = Effect.runSync(
      service.execute(input({ ...ids, anchor: { kind: 'change' } })),
    );
    expect(
      Effect.runSync(
        service.execute(input({ ...ids, anchor: { kind: 'change' } })),
      ),
    ).toEqual(first);
    expect(() => Effect.runSync(service.execute(input(ids)))).toThrow(
      CommentIdentityConflictError,
    );
  });

  it('opens the hundredth thread of a worktree and refuses the next', () => {
    const { service, store } = setup();
    for (let index = 0; index < 100; index += 1)
      Effect.runSync(service.execute(input()));
    expect(store.list({ worktreeId })).toHaveLength(100);
    expect(() => Effect.runSync(service.execute(input()))).toThrow(
      CommentLimitExceededError,
    );
    expect(() =>
      Effect.runSync(service.execute(input({ worktreeId: 'b'.repeat(64) }))),
    ).not.toThrow();
  });

  it('refuses a thread that would take the worktree past one mebibyte', () => {
    const { service, store } = setup();
    const body = 'x'.repeat(15_000);
    let created = 0;
    let refused: unknown;
    while (refused === undefined && created < 100) {
      try {
        Effect.runSync(service.execute(input({ body })));
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

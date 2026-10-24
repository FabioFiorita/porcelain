import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import { SequentialIdSource } from '@porcelain/kernel/fakes';
import { IdSource } from '@porcelain/kernel/ports';
import { testClock } from '@porcelain/kernel/test-kit';
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
import {
  CommentStore,
  CreateCommentThreadOptions,
} from '@porcelain/reviews/ports';
import { Clock, Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { CreateCommentThreadService } from './create-comment-thread-service.ts';

const worktreeId = 'a'.repeat(64);
const limits = {
  threadsPerWorktree: 100,
  messagesPerThread: 100,
  bytesPerWorktree: 1024 * 1024,
};

async function setup() {
  const store = new InMemoryCommentStore();
  const service = Effect.runSync(
    CreateCommentThreadService.pipe(
      Effect.provide(CreateCommentThreadService.layer),
      Effect.provideService(CommentStore, store),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(Clock.Clock, await testClock()),
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
  it('opens an unresolved thread with one message and the next revision', async () => {
    const { service, store } = await setup();
    const thread = Effect.runSync(service.execute(input()));
    expect(thread).toMatchObject({
      worktreeId,
      resolved: false,
      revision: 1,
      messages: [{ body: 'Looks good', author: 'reviewer' }],
    });
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([
      thread,
    ]);
  });

  it('writes as the agent only when the writer is the agent', async () => {
    const { service } = await setup();
    expect(
      Effect.runSync(service.execute(input({ writer: { kind: 'agent' } })))
        .messages[0]?.author,
    ).toBe('agent');
    expect(
      Effect.runSync(service.execute(input({ writer: { kind: 'owner' } })))
        .messages[0]?.author,
    ).toBe('reviewer');
  });

  it('answers a retried create with the original thread and stores nothing new', async () => {
    const { service, store } = await setup();
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
    expect(await Effect.runPromise(store.list({ worktreeId }))).toHaveLength(1);
  });

  const ids = { threadId: 'thread-1', messageId: 'message-1' };
  const firstReview = {
    reviewId: 'review-1',
    revision: 1,
    headOid: 'a'.repeat(40),
  };
  const secondReview = {
    ...firstReview,
    revision: 2,
    headOid: 'b'.repeat(40),
  };
  const retainedAnchor: CommentAnchor = {
    kind: 'change',
    comparison: { kind: 'branch', base: 'refs/heads/main' },
    revision: firstReview.headOid,
  };
  const retainedAnchors: CommentAnchor[] = [
    retainedAnchor,
    { ...retainedAnchor, kind: 'file', filePath: 'README.md' },
    {
      ...retainedAnchor,
      kind: 'codeRange',
      filePath: 'README.md',
      startLine: 1,
      endLine: 2,
      side: 'additions',
    },
  ];
  it.each(
    retainedAnchors.flatMap((anchor) => [
      { anchor, review: secondReview, selection: 'latest' },
      { anchor, review: firstReview, selection: 'explicit historical' },
    ]),
  )(
    'keeps a retried $anchor.kind thread on its original revision with $selection selection',
    async ({ anchor, review }) => {
      const { service, store } = await setup();
      const request = input({ ...ids, anchor, review: firstReview });
      const first = Effect.runSync(service.execute(request));
      expect(Effect.runSync(service.execute({ ...request, review }))).toEqual(
        first,
      );
      expect(first.review).toEqual(firstReview);
      expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([
        first,
      ]);
    },
  );

  it.each<{ name: string; changes: Partial<CreateCommentThreadInput> }>([
    { name: 'body', changes: { body: 'Changed feedback' } },
    {
      name: 'anchor',
      changes: {
        anchor: { ...retainedAnchor, revision: secondReview.headOid },
      },
    },
    { name: 'author', changes: { writer: { kind: 'agent' } } },
    { name: 'message id', changes: { messageId: 'message-2' } },
    {
      name: 'review owner',
      changes: { review: { ...secondReview, reviewId: 'review-2' } },
    },
    { name: 'missing review owner', changes: { review: undefined } },
  ])(
    'refuses a retained thread id reused with another $name after republishing',
    async ({ changes }) => {
      const { service, store } = await setup();
      const request = input({
        ...ids,
        anchor: retainedAnchor,
        review: firstReview,
      });
      const first = Effect.runSync(service.execute(request));
      expect(() =>
        Effect.runSync(
          service.execute({ ...request, review: secondReview, ...changes }),
        ),
      ).toThrow(CommentIdentityConflictError);
      expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([
        first,
      ]);
    },
  );

  it('refuses a new stale review comment but permits current and explicit historical comments', async () => {
    const { service, store } = await setup();
    expect(() =>
      Effect.runSync(
        service.execute(
          input({ anchor: retainedAnchor, review: secondReview }),
        ),
      ),
    ).toThrow(CommentRevisionMismatchError);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
    const current = Effect.runSync(
      service.execute(
        input({
          anchor: { ...retainedAnchor, revision: secondReview.headOid },
          review: secondReview,
        }),
      ),
    );
    const historical = Effect.runSync(
      service.execute(input({ anchor: retainedAnchor, review: firstReview })),
    );
    expect(current.review).toEqual(secondReview);
    expect(historical.review).toEqual(firstReview);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([
      current,
      historical,
    ]);
  });

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
  ])('refuses a thread id reused for $name', async ({ attempt }) => {
    const { service } = await setup();
    Effect.runSync(service.execute(input(ids)));
    expect(() => Effect.runSync(service.execute(attempt))).toThrow(
      CommentIdentityConflictError,
    );
  });

  it('answers a repeated branch comment and refuses the same id against another base', async () => {
    const { service } = await setup();
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

  it('refuses a new thread whose message id already belongs to another thread', async () => {
    const { service } = await setup();
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

  it('refuses a code range that ends before it starts and stores nothing', async () => {
    const { service, store } = await setup();
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
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
  });

  it('opens a thread on a one-line code range', async () => {
    const { service } = await setup();
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
  ])('refuses $name and stores nothing', async ({ anchor }) => {
    const { service, store } = await setup();
    expect(() => Effect.runSync(service.execute(input({ anchor })))).toThrow(
      CommentRevisionMismatchError,
    );
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
  });

  it('opens a thread on a commit comparison that names its object id', async () => {
    const { service } = await setup();
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

  it('opens a thread on a branch comparison that names the tip it was read at', async () => {
    const { service } = await setup();
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

  it('opens a thread on the whole working-tree change', async () => {
    const { service, store } = await setup();
    const thread = Effect.runSync(
      service.execute(input({ anchor: { kind: 'change' } })),
    );
    expect(thread.anchor).toEqual({ kind: 'change' });
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([
      thread,
    ]);
  });

  it('opens a thread on the whole branch change read at its tip', async () => {
    const { service } = await setup();
    const anchor: CommentAnchor = {
      kind: 'change',
      comparison: { kind: 'branch', base: 'refs/heads/main' },
      revision: 'a'.repeat(40),
    };
    expect(Effect.runSync(service.execute(input({ anchor }))).anchor).toEqual(
      anchor,
    );
  });

  it('refuses a whole-branch comment that does not name the tip it was read at', async () => {
    const { service, store } = await setup();
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
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
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
    async (_, anchor) => {
      const { service, store } = await setup();
      expect(() => Effect.runSync(service.execute(input({ anchor })))).toThrow(
        UnsupportedCommentComparisonError,
      );
      expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
    },
  );

  it('answers a repeated whole-change comment and refuses the same id on a file', async () => {
    const { service } = await setup();
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

  it('opens the hundredth thread of a worktree and refuses the next', async () => {
    const { service, store } = await setup();
    for (let index = 0; index < 100; index += 1)
      Effect.runSync(service.execute(input()));
    expect(await Effect.runPromise(store.list({ worktreeId }))).toHaveLength(
      100,
    );
    expect(() => Effect.runSync(service.execute(input()))).toThrow(
      CommentLimitExceededError,
    );
    expect(() =>
      Effect.runSync(service.execute(input({ worktreeId: 'b'.repeat(64) }))),
    ).not.toThrow();
  });

  it('refuses a thread that would take the worktree past one mebibyte', async () => {
    const { service, store } = await setup();
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
    expect(
      (await Effect.runPromise(store.usage({ worktreeId }))).bytes,
    ).toBeLessThanOrEqual(1024 * 1024);
    expect(
      (await Effect.runPromise(store.usage({ worktreeId }))).bytes + 15_000,
    ).toBeGreaterThan(1024 * 1024);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toHaveLength(
      created,
    );
  });
});

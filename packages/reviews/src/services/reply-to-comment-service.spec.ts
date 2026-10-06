import { testClock } from '@porcelain/kernel/test-kit';
import { SequentialIdSource } from '@porcelain/kernel/fakes';
import { IdSource } from '@porcelain/kernel/ports';
import { CommentStore, ReplyToCommentOptions } from '@porcelain/reviews/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentTargetNotFoundError,
} from '@porcelain/reviews/errors';
import { type ReplyToCommentInput } from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { ReplyToCommentService } from './reply-to-comment-service.ts';

const worktreeId = 'a'.repeat(64);
const threadId = 'thread-1';
const limits = {
  threadsPerWorktree: 100,
  messagesPerThread: 100,
  bytesPerWorktree: 1024 * 1024,
};

async function setup(body = 'Opening message') {
  const store = new InMemoryCommentStore();
  await Effect.runPromise(
    store.insert({
      content: {
        id: threadId,
        worktreeId,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [{ id: 'message-0', body, author: 'reviewer' }],
      },
      sizeBytes: 200 + body.length,
      writtenByAgent: false,
    }),
  );
  const service = Effect.runSync(
    ReplyToCommentService.pipe(
      Effect.provide(ReplyToCommentService.layer),
      Effect.provideService(CommentStore, store),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(Clock.Clock, await testClock()),
      Effect.provideService(ReplyToCommentOptions, limits),
    ),
  );
  return { store, service };
}

function input(
  overrides: Partial<ReplyToCommentInput> = {},
): ReplyToCommentInput {
  return {
    worktreeId,
    threadId,
    body: 'Thanks',
    writer: { kind: 'agent' },
    ...overrides,
  };
}

describe('ReplyToCommentService', () => {
  it('appends the reply and moves the thread to the next revision', async () => {
    const { service, store } = await setup();
    const thread = Effect.runSync(service.execute(input()));
    expect(thread.revision).toBe(2);
    expect(thread.messages.map((message) => message.body)).toEqual([
      'Opening message',
      'Thanks',
    ]);
    expect(await Effect.runPromise(store.find({ threadId }))).toEqual(thread);
  });

  it('answers a retried reply with the thread and appends nothing', async () => {
    const { service, store } = await setup();
    Effect.runSync(service.execute(input({ messageId: 'reply-1' })));
    Effect.runSync(service.execute(input({ messageId: 'reply-1' })));
    expect(
      (await Effect.runPromise(store.find({ threadId })))?.messages,
    ).toHaveLength(2);
  });

  it('refuses a message id reused for another body or another thread', async () => {
    const { service } = await setup();
    Effect.runSync(service.execute(input({ messageId: 'reply-1' })));
    expect(() =>
      Effect.runSync(
        service.execute(input({ messageId: 'reply-1', body: 'Different' })),
      ),
    ).toThrow(CommentIdentityConflictError);
    expect(() =>
      Effect.runSync(
        service.execute(input({ messageId: 'message-0', body: 'Thanks' })),
      ),
    ).toThrow(CommentIdentityConflictError);
  });

  it('does not find a thread of another worktree or an unknown thread', async () => {
    const { service } = await setup();
    expect(() =>
      Effect.runSync(service.execute(input({ worktreeId: 'b'.repeat(64) }))),
    ).toThrow(CommentTargetNotFoundError);
    expect(() =>
      Effect.runSync(service.execute(input({ threadId: 'missing' }))),
    ).toThrow(CommentTargetNotFoundError);
  });

  it('accepts the hundredth message of a thread and refuses the next', async () => {
    const { service, store } = await setup();
    for (let index = 1; index < 100; index += 1)
      Effect.runSync(service.execute(input()));
    expect(
      (await Effect.runPromise(store.find({ threadId })))?.messages,
    ).toHaveLength(100);
    expect(() => Effect.runSync(service.execute(input()))).toThrow(
      CommentLimitExceededError,
    );
    expect(
      (await Effect.runPromise(store.find({ threadId })))?.messages,
    ).toHaveLength(100);
  });

  it('refuses a reply that would take the worktree past one mebibyte', async () => {
    const { service, store } = await setup('x'.repeat(1024 * 1024 - 1000));
    expect(() =>
      Effect.runSync(service.execute(input({ body: 'y'.repeat(2000) }))),
    ).toThrow(CommentLimitExceededError);
    expect(
      (await Effect.runPromise(store.find({ threadId })))?.messages,
    ).toHaveLength(1);
  });
});

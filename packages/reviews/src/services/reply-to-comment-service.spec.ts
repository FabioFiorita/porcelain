import { describe, expect, it } from 'vitest';
import {
  CommentIdentityConflictError,
  CommentLimitExceededError,
  CommentTargetNotFoundError,
} from '@porcelain/reviews/errors';
import type { ReplyToCommentInput } from '@porcelain/reviews/models';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { SequentialIdSource } from '../../spec/fakes/sequential-id-source.ts';
import { ReplyToCommentService } from './reply-to-comment-service.ts';

const worktreeId = 'a'.repeat(64);
const threadId = 'thread-1';

function setup(body = 'Opening message') {
  const store = new InMemoryCommentStore();
  store.insert(
    {
      id: threadId,
      worktreeId,
      anchor: { kind: 'file', filePath: 'README.md' },
      resolved: false,
      messages: [{ id: 'message-0', body, author: 'reviewer' }],
      revision: 1,
    },
    { sizeBytes: 200 + body.length, lastAgentRevision: undefined },
  );
  const service = new ReplyToCommentService(
    store,
    new SequentialIdSource(),
    new FixedClock(),
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
  it('appends the reply and moves the thread to the next revision', () => {
    const { service, store } = setup();
    const thread = service.execute(input());
    expect(thread.revision).toBe(2);
    expect(thread.messages.map((message) => message.body)).toEqual([
      'Opening message',
      'Thanks',
    ]);
    expect(store.find(threadId)).toEqual(thread);
  });

  it('answers a retried reply with the thread and appends nothing', () => {
    const { service, store } = setup();
    service.execute(input({ messageId: 'reply-1' }));
    service.execute(input({ messageId: 'reply-1' }));
    expect(store.find(threadId)?.messages).toHaveLength(2);
  });

  it('refuses a message id reused for another body or another thread', () => {
    const { service } = setup();
    service.execute(input({ messageId: 'reply-1' }));
    expect(() =>
      service.execute(input({ messageId: 'reply-1', body: 'Different' })),
    ).toThrow(CommentIdentityConflictError);
    expect(() =>
      service.execute(input({ messageId: 'message-0', body: 'Thanks' })),
    ).toThrow(CommentIdentityConflictError);
  });

  it('does not find a thread of another worktree or an unknown thread', () => {
    const { service } = setup();
    expect(() =>
      service.execute(input({ worktreeId: 'b'.repeat(64) })),
    ).toThrow(CommentTargetNotFoundError);
    expect(() => service.execute(input({ threadId: 'missing' }))).toThrow(
      CommentTargetNotFoundError,
    );
  });

  it('accepts the hundredth message of a thread and refuses the next', () => {
    const { service, store } = setup();
    for (let index = 1; index < 100; index += 1) service.execute(input());
    expect(store.find(threadId)?.messages).toHaveLength(100);
    expect(() => service.execute(input())).toThrow(CommentLimitExceededError);
    expect(store.find(threadId)?.messages).toHaveLength(100);
  });

  it('refuses a reply that would take the worktree past one mebibyte', () => {
    const { service, store } = setup('x'.repeat(1024 * 1024 - 1000));
    expect(() => service.execute(input({ body: 'y'.repeat(2000) }))).toThrow(
      CommentLimitExceededError,
    );
    expect(store.find(threadId)?.messages).toHaveLength(1);
  });
});

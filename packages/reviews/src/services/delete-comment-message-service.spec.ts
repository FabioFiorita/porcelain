import { CommentStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  CommentAuthorMismatchError,
  CommentTargetNotFoundError,
} from '@porcelain/reviews/errors';
import { type DeleteCommentMessageInput } from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { DeleteCommentMessageService } from './delete-comment-message-service.ts';

const worktreeId = 'a'.repeat(64);
const threadId = 'thread-1';

function setup() {
  const store = new InMemoryCommentStore();
  store.insert({
    content: {
      id: threadId,
      worktreeId,
      anchor: { kind: 'file', filePath: 'README.md' },
      messages: [
        { id: 'question', body: 'Why?', author: 'reviewer' },
        { id: 'answer', body: 'Because.', author: 'agent' },
        { id: 'follow-up', body: 'Thanks', author: 'reviewer' },
      ],
    },
    sizeBytes: 400,
    writtenByAgent: false,
  });
  return {
    store,
    service: Effect.runSync(
      DeleteCommentMessageService.pipe(
        Effect.provide(DeleteCommentMessageService.layer),
        Effect.provideService(CommentStore, store),
      ),
    ),
  };
}

function input(
  overrides: Partial<DeleteCommentMessageInput> = {},
): DeleteCommentMessageInput {
  return {
    worktreeId,
    threadId,
    messageId: 'follow-up',
    writer: { kind: 'device' },
    ...overrides,
  };
}

describe('DeleteCommentMessageService', () => {
  it("removes the reviewer's own message and answers the rest of the thread at the next revision", () => {
    const { service, store } = setup();
    const result = Effect.runSync(service.execute(input()));
    expect(result.threadId).toBe(threadId);
    expect(result.thread?.revision).toBe(2);
    expect(result.thread?.messages.map((message) => message.id)).toEqual([
      'question',
      'answer',
    ]);
    expect(store.find({ threadId })).toEqual(result.thread);
    expect(store.usage({ worktreeId }).bytes).toBeLessThan(400);
  });

  it('keeps the replies when the opening message is removed', () => {
    const { service, store } = setup();
    Effect.runSync(service.execute(input({ messageId: 'question' })));
    expect(
      store.find({ threadId })?.messages.map((message) => message.id),
    ).toEqual(['answer', 'follow-up']);
  });

  it('removes the thread with its last message', () => {
    const { service, store } = setup();
    Effect.runSync(service.execute(input({ messageId: 'question' })));
    Effect.runSync(service.execute(input()));
    expect(
      Effect.runSync(
        service.execute(
          input({ messageId: 'answer', writer: { kind: 'agent' } }),
        ),
      ),
    ).toEqual({ threadId, thread: undefined });
    expect(store.find({ threadId })).toBeUndefined();
    expect(store.list({ worktreeId })).toEqual([]);
    expect(store.usage({ worktreeId })).toEqual({ threads: 0, bytes: 0 });
  });

  it("refuses a reviewer removing the agent's message and keeps it", () => {
    const { service, store } = setup();
    expect(() =>
      Effect.runSync(service.execute(input({ messageId: 'answer' }))),
    ).toThrow(CommentAuthorMismatchError);
    expect(store.find({ threadId })?.messages).toHaveLength(3);
  });

  it("refuses the agent removing a reviewer's message", () => {
    const { service } = setup();
    expect(() =>
      Effect.runSync(service.execute(input({ writer: { kind: 'agent' } }))),
    ).toThrow(CommentAuthorMismatchError);
  });

  it('does not find a message already removed, an unknown thread or a thread of another worktree', () => {
    const { service } = setup();
    Effect.runSync(service.execute(input()));
    expect(() => Effect.runSync(service.execute(input()))).toThrow(
      CommentTargetNotFoundError,
    );
    expect(() =>
      Effect.runSync(service.execute(input({ threadId: 'missing' }))),
    ).toThrow(CommentTargetNotFoundError);
    expect(() =>
      Effect.runSync(
        service.execute(
          input({ worktreeId: 'b'.repeat(64), messageId: 'question' }),
        ),
      ),
    ).toThrow(CommentTargetNotFoundError);
  });
});

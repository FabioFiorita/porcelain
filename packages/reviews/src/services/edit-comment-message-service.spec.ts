import { Clock } from '@porcelain/kernel/ports';
import {
  CommentStore,
  EditCommentMessageOptions,
} from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import {
  CommentAuthorMismatchError,
  CommentLimitExceededError,
  CommentTargetNotFoundError,
} from '@porcelain/reviews/errors';
import { type EditCommentMessageInput } from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { EditCommentMessageService } from './edit-comment-message-service.ts';

const worktreeId = 'a'.repeat(64);
const threadId = 'thread-1';

function setup(bytesPerWorktree = 1024 * 1024) {
  const store = new InMemoryCommentStore();
  store.insert({
    content: {
      id: threadId,
      worktreeId,
      anchor: { kind: 'file', filePath: 'README.md' },
      messages: [
        { id: 'question', body: 'Why?', author: 'reviewer' },
        { id: 'answer', body: 'Because.', author: 'agent' },
      ],
    },
    sizeBytes: 300,
    writtenByAgent: true,
  });
  const clock = new FixedClock();
  const service = Effect.runSync(
    EditCommentMessageService.pipe(
      Effect.provide(EditCommentMessageService.layer),
      Effect.provideService(CommentStore, store),
      Effect.provideService(Clock, clock),
      Effect.provideService(EditCommentMessageOptions, {
        bytesPerWorktree,
      }),
    ),
  );
  return { store, service, clock };
}

function input(
  overrides: Partial<EditCommentMessageInput> = {},
): EditCommentMessageInput {
  return {
    worktreeId,
    threadId,
    messageId: 'question',
    body: 'Why this line?',
    writer: { kind: 'device' },
    ...overrides,
  };
}

describe('EditCommentMessageService', () => {
  it("rewrites the reviewer's own message, stamps the edit and moves the thread to the next revision", () => {
    const { service, store, clock } = setup();
    const { thread, changed } = Effect.runSync(service.execute(input()));
    expect(changed).toBe(true);
    expect(thread.revision).toBe(2);
    expect(thread.messages).toEqual([
      {
        id: 'question',
        body: 'Why this line?',
        author: 'reviewer',
        editedAt: clock.now(),
      },
      { id: 'answer', body: 'Because.', author: 'agent' },
    ]);
    expect(store.find({ threadId })).toEqual(thread);
  });

  it('lets any reviewer device or the owner edit a reviewer message', () => {
    const { service } = setup();
    expect(
      Effect.runSync(service.execute(input({ writer: { kind: 'owner' } })))
        .changed,
    ).toBe(true);
  });

  it("lets the agent edit only the agent's own message", () => {
    const { service } = setup();
    expect(
      Effect.runSync(
        service.execute(
          input({
            messageId: 'answer',
            body: 'Fixed.',
            writer: { kind: 'agent' },
          }),
        ),
      ).thread.messages[1]?.body,
    ).toBe('Fixed.');
    expect(() =>
      Effect.runSync(service.execute(input({ writer: { kind: 'agent' } }))),
    ).toThrow(CommentAuthorMismatchError);
  });

  it("refuses a reviewer editing the agent's message and keeps it", () => {
    const { service, store } = setup();
    expect(() =>
      Effect.runSync(service.execute(input({ messageId: 'answer' }))),
    ).toThrow(CommentAuthorMismatchError);
    expect(store.find({ threadId })?.messages[1]?.body).toBe('Because.');
  });

  it('answers the same text without a new revision and reports no change', () => {
    const { service, store } = setup();
    expect(
      Effect.runSync(service.execute(input({ body: 'Why?' }))),
    ).toMatchObject({
      thread: { revision: 1 },
      changed: false,
    });
    expect(store.find({ threadId })?.messages[0]?.editedAt).toBeUndefined();
  });

  it('does not find an unknown message, an unknown thread or a thread of another worktree', () => {
    const { service } = setup();
    expect(() =>
      Effect.runSync(service.execute(input({ messageId: 'missing' }))),
    ).toThrow(CommentTargetNotFoundError);
    expect(() =>
      Effect.runSync(service.execute(input({ threadId: 'missing' }))),
    ).toThrow(CommentTargetNotFoundError);
    expect(() =>
      Effect.runSync(service.execute(input({ worktreeId: 'b'.repeat(64) }))),
    ).toThrow(CommentTargetNotFoundError);
  });

  it('refuses a longer text that would take the worktree past its capacity', () => {
    const { service, store } = setup(320);
    expect(() =>
      Effect.runSync(service.execute(input({ body: 'x'.repeat(400) }))),
    ).toThrow(CommentLimitExceededError);
    expect(store.find({ threadId })?.messages[0]?.body).toBe('Why?');
  });
});

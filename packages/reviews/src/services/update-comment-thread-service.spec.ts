import { describe, expect, it } from 'vitest';
import { CommentTargetNotFoundError } from '@porcelain/reviews/errors';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { UpdateCommentThreadService } from './update-comment-thread-service.ts';

const worktreeId = 'a'.repeat(64);
const threadId = 'thread-1';

function setup() {
  const store = new InMemoryCommentStore();
  store.insert({
    content: {
      id: threadId,
      worktreeId,
      anchor: { kind: 'file', filePath: 'README.md' },
      messages: [{ id: 'message-1', body: 'Why?', author: 'reviewer' }],
    },
    sizeBytes: 100,
    writtenByAgent: false,
  });
  return { store, service: new UpdateCommentThreadService(store) };
}

describe('UpdateCommentThreadService', () => {
  it('resolves an open thread at the next revision', () => {
    const { service, store } = setup();
    const thread = service.execute({ worktreeId, threadId, resolved: true });
    expect(thread).toMatchObject({ resolved: true, revision: 2 });
    expect(store.find({ threadId })).toEqual(thread);
  });

  it('reopens a resolved thread', () => {
    const { service } = setup();
    service.execute({ worktreeId, threadId, resolved: true });
    expect(
      service.execute({ worktreeId, threadId, resolved: false }),
    ).toMatchObject({ resolved: false, revision: 3 });
  });

  it('answers a thread already in the requested state without a new revision', () => {
    const { service, store } = setup();
    expect(
      service.execute({ worktreeId, threadId, resolved: false }).revision,
    ).toBe(1);
    expect(store.find({ threadId })?.revision).toBe(1);
  });

  it('does not find a thread of another worktree or an unknown thread', () => {
    const { service, store } = setup();
    expect(() =>
      service.execute({
        worktreeId: 'b'.repeat(64),
        threadId,
        resolved: true,
      }),
    ).toThrow(CommentTargetNotFoundError);
    expect(() =>
      service.execute({ worktreeId, threadId: 'missing', resolved: true }),
    ).toThrow(CommentTargetNotFoundError);
    expect(store.find({ threadId })?.resolved).toBe(false);
  });
});

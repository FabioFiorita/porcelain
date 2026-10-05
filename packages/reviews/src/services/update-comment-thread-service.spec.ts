import { CommentStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { CommentTargetNotFoundError } from '@porcelain/reviews/errors';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { UpdateCommentThreadService } from './update-comment-thread-service.ts';

const worktreeId = 'a'.repeat(64);
const threadId = 'thread-1';

async function setup() {
  const store = new InMemoryCommentStore();
  await Effect.runPromise(
    store.insert({
      content: {
        id: threadId,
        worktreeId,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [{ id: 'message-1', body: 'Why?', author: 'reviewer' }],
      },
      sizeBytes: 100,
      writtenByAgent: false,
    }),
  );
  return {
    store,
    service: Effect.runSync(
      UpdateCommentThreadService.pipe(
        Effect.provide(UpdateCommentThreadService.layer),
        Effect.provideService(CommentStore, store),
      ),
    ),
  };
}

describe('UpdateCommentThreadService', () => {
  it('resolves an open thread at the next revision', async () => {
    const { service, store } = await setup();
    const { thread, changed } = Effect.runSync(
      service.execute({
        worktreeId,
        threadId,
        resolved: true,
      }),
    );
    expect({ thread, changed }).toMatchObject({
      thread: { resolved: true, revision: 2 },
      changed: true,
    });
    expect(await Effect.runPromise(store.find({ threadId }))).toEqual(thread);
  });

  it('reopens a resolved thread', async () => {
    const { service } = await setup();
    Effect.runSync(service.execute({ worktreeId, threadId, resolved: true }));
    expect(
      Effect.runSync(
        service.execute({ worktreeId, threadId, resolved: false }),
      ),
    ).toMatchObject({
      thread: { resolved: false, revision: 3 },
      changed: true,
    });
  });

  it('answers a thread already in the requested state without a new revision and reports no change', async () => {
    const { service, store } = await setup();
    expect(
      Effect.runSync(
        service.execute({ worktreeId, threadId, resolved: false }),
      ),
    ).toMatchObject({ thread: { revision: 1 }, changed: false });
    expect((await Effect.runPromise(store.find({ threadId })))?.revision).toBe(
      1,
    );
  });

  it('does not find a thread of another worktree or an unknown thread', async () => {
    const { service, store } = await setup();
    expect(() =>
      Effect.runSync(
        service.execute({
          worktreeId: 'b'.repeat(64),
          threadId,
          resolved: true,
        }),
      ),
    ).toThrow(CommentTargetNotFoundError);
    expect(() =>
      Effect.runSync(
        service.execute({ worktreeId, threadId: 'missing', resolved: true }),
      ),
    ).toThrow(CommentTargetNotFoundError);
    expect((await Effect.runPromise(store.find({ threadId })))?.resolved).toBe(
      false,
    );
  });
});

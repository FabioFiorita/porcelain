import { CommentStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { type CommentAuthorRole } from '@porcelain/reviews/models';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { ListCommentThreadsService } from './list-comment-threads-service.ts';

const worktreeId = 'a'.repeat(64);

async function open(
  store: InMemoryCommentStore,
  id: string,
  authors: readonly CommentAuthorRole[],
  owner = worktreeId,
) {
  return await Effect.runPromise(
    store.insert({
      content: {
        id,
        worktreeId: owner,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: authors.map((author, index) => ({
          id: `${id}-message-${index}`,
          body: 'Message',
          author,
        })),
      },
      sizeBytes: 100,
      writtenByAgent: false,
    }),
  );
}

async function setup() {
  const store = new InMemoryCommentStore();
  await open(store, 'asked', ['reviewer']);
  await open(store, 'answered', ['reviewer', 'agent']);
  await open(store, 'followed-up', ['reviewer', 'agent', 'reviewer']);
  const done = await open(store, 'done', ['reviewer']);
  await Effect.runPromise(store.resolve({ thread: done, resolved: true }));
  await open(store, 'elsewhere', ['reviewer'], 'b'.repeat(64));
  return Effect.runSync(
    ListCommentThreadsService.pipe(
      Effect.provide(ListCommentThreadsService.layer),
      Effect.provideService(CommentStore, store),
    ),
  );
}

const ids = (threads: readonly { id: string }[]) =>
  threads.map((thread) => thread.id);

describe('ListCommentThreadsService', () => {
  it('lists every thread of the worktree when no scope or the all scope is asked', async () => {
    const service = await setup();
    const every = ['asked', 'answered', 'followed-up', 'done'];
    expect(ids(Effect.runSync(service.execute({ worktreeId })))).toEqual(every);
    expect(
      ids(Effect.runSync(service.execute({ worktreeId, scope: 'all' }))),
    ).toEqual(every);
  });

  it('lists only open threads whose latest message is not from the agent when waiting is asked', async () => {
    expect(
      ids(
        Effect.runSync(
          (await setup()).execute({ worktreeId, scope: 'waiting' }),
        ),
      ),
    ).toEqual(['asked', 'followed-up']);
  });
});

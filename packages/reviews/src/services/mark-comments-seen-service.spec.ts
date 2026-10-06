import { CommentSeenStore, CommentStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryCommentSeenStore } from '../../spec/fakes/in-memory-comment-seen-store.ts';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';
import { MarkCommentsSeenService } from './mark-comments-seen-service.ts';

const worktreeId = 'a'.repeat(64);

async function setup() {
  const comments = new InMemoryCommentStore();
  const threads: [string, string][] = [
    ['first', worktreeId],
    ['second', worktreeId],
    ['elsewhere', 'b'.repeat(64)],
  ];
  for (const [id, owner] of threads)
    await Effect.runPromise(
      comments.insert({
        content: {
          id,
          worktreeId: owner,
          anchor: { kind: 'file', filePath: 'README.md' },
          messages: [{ id: `${id}-message`, body: 'Why?', author: 'reviewer' }],
        },
        sizeBytes: 100,
        writtenByAgent: false,
      }),
    );
  const seen = new InMemoryCommentSeenStore();
  return {
    seen,
    service: Effect.runSync(
      MarkCommentsSeenService.pipe(
        Effect.provide(MarkCommentsSeenService.layer),
        Effect.provideService(CommentSeenStore, seen),
        Effect.provideService(CommentStore, comments),
      ),
    ),
  };
}

describe('MarkCommentsSeenService', () => {
  it('records the revision the reader saw', async () => {
    const { service, seen } = await setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, throughRevision: 1 })),
    ).toEqual({
      worktreeId,
      seenThrough: 1,
      changed: true,
    });
    expect(await Effect.runPromise(seen.seenThrough({ worktreeId }))).toBe(1);
  });

  it('never marks past the latest revision of the worktree', async () => {
    const { service } = await setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, throughRevision: 99 }))
        .seenThrough,
    ).toBe(2);
  });

  it('reports no change when the reader has already seen that far', async () => {
    const { service } = await setup();
    Effect.runSync(service.execute({ worktreeId, throughRevision: 2 }));
    expect(
      Effect.runSync(service.execute({ worktreeId, throughRevision: 2 }))
        .changed,
    ).toBe(false);
  });

  it('never moves the mark backwards', async () => {
    const { service, seen } = await setup();
    Effect.runSync(service.execute({ worktreeId, throughRevision: 2 }));
    expect(
      Effect.runSync(service.execute({ worktreeId, throughRevision: 1 }))
        .seenThrough,
    ).toBe(2);
    expect(await Effect.runPromise(seen.seenThrough({ worktreeId }))).toBe(2);
  });
});

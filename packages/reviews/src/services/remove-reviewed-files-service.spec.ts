import { ReviewedFileStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { RemoveReviewedFilesService } from './remove-reviewed-files-service.ts';

const worktreeId = 'a'.repeat(64);
const other = 'b'.repeat(64);
const reviewedAt = '2026-09-01T00:00:00.000Z';

function mark(path: string) {
  return { path, fingerprint: `fingerprint-${path}`, reviewedAt, stale: false };
}

function setup() {
  const store = new InMemoryReviewedFileStore([
    { worktreeId, mark: mark('a.ts') },
    { worktreeId, mark: mark('b.ts') },
    { worktreeId, mark: mark('c.ts') },
    { worktreeId: other, mark: mark('a.ts') },
  ]);
  return {
    store,
    service: Effect.runSync(
      RemoveReviewedFilesService.pipe(
        Effect.provide(RemoveReviewedFilesService.layer),
        Effect.provideService(ReviewedFileStore, store),
      ),
    ),
  };
}

describe('RemoveReviewedFilesService', () => {
  it('removes the mark and answers the marks that remain', () => {
    const { service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['a.ts'] })),
    ).toEqual({
      worktreeId,
      marks: [
        { path: 'b.ts', fingerprint: 'fingerprint-b.ts', reviewedAt },
        { path: 'c.ts', fingerprint: 'fingerprint-c.ts', reviewedAt },
      ],
      removed: true,
    });
  });

  it('removes every listed mark in one call and keeps the unlisted ones', async () => {
    const { store, service } = setup();
    const result = Effect.runSync(
      service.execute({ worktreeId, paths: ['a.ts', 'c.ts'] }),
    );
    expect(result.removed).toBe(true);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([
      mark('b.ts'),
    ]);
  });

  it('removes the marked paths among unmarked ones and reports a removal', async () => {
    const { store, service } = setup();
    const result = Effect.runSync(
      service.execute({ worktreeId, paths: ['x.ts', 'b.ts'] }),
    );
    expect(result.removed).toBe(true);
    expect(
      (await Effect.runPromise(store.list({ worktreeId }))).map(
        (entry) => entry.path,
      ),
    ).toEqual(['a.ts', 'c.ts']);
  });

  it('leaves the same path marked in another worktree', async () => {
    const { store, service } = setup();
    Effect.runSync(
      service.execute({ worktreeId, paths: ['a.ts', 'b.ts', 'c.ts'] }),
    );
    expect(await Effect.runPromise(store.list({ worktreeId }))).toEqual([]);
    expect(await Effect.runPromise(store.list({ worktreeId: other }))).toEqual([
      mark('a.ts'),
    ]);
  });

  it('reports nothing removed for paths that were never marked', async () => {
    const { store, service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['x.ts', 'y.ts'] }))
        .removed,
    ).toBe(false);
    expect(await Effect.runPromise(store.list({ worktreeId }))).toHaveLength(3);
  });

  it('reports nothing removed when the same marks are removed twice', () => {
    const { service } = setup();
    Effect.runSync(service.execute({ worktreeId, paths: ['a.ts', 'b.ts'] }));
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['a.ts', 'b.ts'] }))
        .removed,
    ).toBe(false);
  });

  it('removes a mark listed twice once', async () => {
    const { store, service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['a.ts', 'a.ts'] }))
        .removed,
    ).toBe(true);
    expect(
      (await Effect.runPromise(store.list({ worktreeId }))).map(
        (entry) => entry.path,
      ),
    ).toEqual(['b.ts', 'c.ts']);
  });
});

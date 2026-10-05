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
  return { store, service: new RemoveReviewedFilesService(store) };
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

  it('removes every listed mark in one call and keeps the unlisted ones', () => {
    const { store, service } = setup();
    const result = Effect.runSync(
      service.execute({ worktreeId, paths: ['a.ts', 'c.ts'] }),
    );
    expect(result.removed).toBe(true);
    expect(store.list({ worktreeId })).toEqual([mark('b.ts')]);
  });

  it('removes the marked paths among unmarked ones and reports a removal', () => {
    const { store, service } = setup();
    const result = Effect.runSync(
      service.execute({ worktreeId, paths: ['x.ts', 'b.ts'] }),
    );
    expect(result.removed).toBe(true);
    expect(store.list({ worktreeId }).map((entry) => entry.path)).toEqual([
      'a.ts',
      'c.ts',
    ]);
  });

  it('leaves the same path marked in another worktree', () => {
    const { store, service } = setup();
    Effect.runSync(
      service.execute({ worktreeId, paths: ['a.ts', 'b.ts', 'c.ts'] }),
    );
    expect(store.list({ worktreeId })).toEqual([]);
    expect(store.list({ worktreeId: other })).toEqual([mark('a.ts')]);
  });

  it('reports nothing removed for paths that were never marked', () => {
    const { store, service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['x.ts', 'y.ts'] }))
        .removed,
    ).toBe(false);
    expect(store.list({ worktreeId })).toHaveLength(3);
  });

  it('reports nothing removed when the same marks are removed twice', () => {
    const { service } = setup();
    Effect.runSync(service.execute({ worktreeId, paths: ['a.ts', 'b.ts'] }));
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['a.ts', 'b.ts'] }))
        .removed,
    ).toBe(false);
  });

  it('removes a mark listed twice once', () => {
    const { store, service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['a.ts', 'a.ts'] }))
        .removed,
    ).toBe(true);
    expect(store.list({ worktreeId }).map((entry) => entry.path)).toEqual([
      'b.ts',
      'c.ts',
    ]);
  });
});

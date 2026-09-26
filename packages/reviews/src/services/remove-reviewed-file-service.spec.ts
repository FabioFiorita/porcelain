import { describe, expect, it } from 'vitest';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { RemoveReviewedFileService } from './remove-reviewed-file-service.ts';

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
    { worktreeId: other, mark: mark('a.ts') },
  ]);
  return { store, service: new RemoveReviewedFileService(store) };
}

describe('RemoveReviewedFileService', () => {
  it('removes the mark and answers the marks that remain', () => {
    const { service } = setup();
    expect(service.execute({ worktreeId, path: 'a.ts' })).toEqual({
      worktreeId,
      marks: [{ path: 'b.ts', fingerprint: 'fingerprint-b.ts', reviewedAt }],
      removed: true,
    });
  });

  it('leaves the same path marked in another worktree', () => {
    const { store, service } = setup();
    service.execute({ worktreeId, path: 'a.ts' });
    expect(store.list({ worktreeId: other })).toEqual([mark('a.ts')]);
  });

  it('reports nothing removed for a path that was never marked', () => {
    const { store, service } = setup();
    expect(service.execute({ worktreeId, path: 'c.ts' }).removed).toBe(false);
    expect(store.list({ worktreeId })).toHaveLength(2);
  });

  it('reports nothing removed when the same mark is removed twice', () => {
    const { service } = setup();
    service.execute({ worktreeId, path: 'a.ts' });
    expect(service.execute({ worktreeId, path: 'a.ts' }).removed).toBe(false);
  });
});

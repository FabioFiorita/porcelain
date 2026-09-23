import { describe, expect, it } from 'vitest';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { ReconcileReviewedFilesService } from './reconcile-reviewed-files-service.ts';

const worktreeId = 'a'.repeat(64);

function setup() {
  const store = new InMemoryReviewedFileStore();
  store.save(worktreeId, {
    path: 'kept.txt',
    fingerprint: 'k',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    stale: true,
  });
  store.save(worktreeId, {
    path: 'edited.txt',
    fingerprint: 'e',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    stale: false,
  });
  store.save(worktreeId, {
    path: 'committed.txt',
    fingerprint: 'c',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    stale: false,
  });
  return { store, service: new ReconcileReviewedFilesService(store) };
}

const staleness = (store: InMemoryReviewedFileStore) =>
  Object.fromEntries(
    store.list(worktreeId).map((mark) => [mark.path, mark.stale]),
  );

describe('ReconcileReviewedFilesService', () => {
  it('marks fresh what matches the current fingerprint and stale what does not', () => {
    const { store, service } = setup();
    service.execute({
      worktreeId,
      fingerprints: new Map([
        ['kept.txt', 'k'],
        ['edited.txt', 'e2'],
      ]),
    });
    expect(staleness(store)).toEqual({
      'committed.txt': true,
      'edited.txt': true,
      'kept.txt': false,
    });
  });

  it('treats a change without a readable fingerprint as stale', () => {
    const { store, service } = setup();
    service.execute({
      worktreeId,
      fingerprints: new Map([['committed.txt', undefined]]),
    });
    expect(staleness(store)['committed.txt']).toBe(true);
  });

  it('keeps marks, only changing whether they are stale', () => {
    const { store, service } = setup();
    service.execute({ worktreeId, fingerprints: new Map() });
    expect(store.list(worktreeId).map((mark) => mark.fingerprint)).toEqual([
      'c',
      'e',
      'k',
    ]);
  });
});

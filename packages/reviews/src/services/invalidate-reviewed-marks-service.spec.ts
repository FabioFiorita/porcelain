import { describe, expect, it } from 'vitest';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { InvalidateReviewedMarksService } from './invalidate-reviewed-marks-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

function setup() {
  const files = new InMemoryReviewedFileStore();
  const layers = new InMemoryReviewedLayerStore();
  for (const id of [worktreeId, otherWorktreeId]) {
    for (const path of ['src/app.ts', 'src/app.tsx', 'srcs/x.ts', 'README.md'])
      files.save({
        worktreeId: id,
        marks: [
          {
            path,
            fingerprint: 'f',
            reviewedAt: '2026-01-01T00:00:00.000Z',
            stale: false,
          },
        ],
      });
    layers.save({
      worktreeId: id,
      mark: {
        layerId: 'layer-1',
        fingerprint: 'l',
        reviewedAt: '2026-01-01T00:00:00.000Z',
        stale: false,
      },
    });
  }
  return {
    files,
    layers,
    service: new InvalidateReviewedMarksService(files, layers),
  };
}

const stalePaths = (store: InMemoryReviewedFileStore, id: string) =>
  store
    .list({ worktreeId: id })
    .filter((mark) => mark.stale)
    .map((mark) => mark.path);

describe('InvalidateReviewedMarksService', () => {
  it('makes stale the marks at a changed path or under a changed directory', () => {
    const { service, files } = setup();
    service.execute({ worktreeId, paths: ['src'] });
    expect(stalePaths(files, worktreeId)).toEqual([
      'src/app.ts',
      'src/app.tsx',
    ]);
  });

  it('does not treat a shared name prefix as a directory', () => {
    const { service, files } = setup();
    service.execute({ worktreeId, paths: ['src/app.ts'] });
    expect(stalePaths(files, worktreeId)).toEqual(['src/app.ts']);
  });

  it('makes every mark stale when the changed paths are unknown', () => {
    const { service, files, layers } = setup();
    service.execute({ worktreeId });
    expect(stalePaths(files, worktreeId)).toHaveLength(4);
    expect(layers.list({ worktreeId })[0]?.stale).toBe(true);
  });

  it('makes layer marks stale when any path changed', () => {
    const { service, layers } = setup();
    service.execute({ worktreeId, paths: ['unrelated.txt'] });
    expect(layers.list({ worktreeId })[0]?.stale).toBe(true);
  });

  it('changes nothing for an empty list of paths', () => {
    const { service, files, layers } = setup();
    service.execute({ worktreeId, paths: [] });
    expect(stalePaths(files, worktreeId)).toEqual([]);
    expect(layers.list({ worktreeId })[0]?.stale).toBe(false);
  });

  it('leaves other worktrees alone', () => {
    const { service, files, layers } = setup();
    service.execute({ worktreeId });
    expect(stalePaths(files, otherWorktreeId)).toEqual([]);
    expect(layers.list({ worktreeId: otherWorktreeId })[0]?.stale).toBe(false);
  });
});

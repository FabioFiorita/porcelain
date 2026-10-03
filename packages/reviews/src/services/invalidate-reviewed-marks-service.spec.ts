import { describe, expect, it } from 'vitest';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { InvalidateReviewedMarksService } from './invalidate-reviewed-marks-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

function setup() {
  const files = new InMemoryReviewedFileStore();
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
  }
  return {
    files,
    service: new InvalidateReviewedMarksService(files),
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
    expect(service.execute({ worktreeId, paths: ['src'] })).toEqual({
      changed: true,
    });
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
    const { service, files } = setup();
    service.execute({ worktreeId });
    expect(stalePaths(files, worktreeId)).toHaveLength(4);
  });

  it('reports no change once every touched mark is already stale', () => {
    const { service } = setup();
    service.execute({ worktreeId });
    expect(service.execute({ worktreeId })).toEqual({ changed: false });
  });

  it('changes nothing for an empty list of paths', () => {
    const { service, files } = setup();
    expect(service.execute({ worktreeId, paths: [] })).toEqual({
      changed: false,
    });
    expect(stalePaths(files, worktreeId)).toEqual([]);
  });

  it('leaves other worktrees alone', () => {
    const { service, files } = setup();
    service.execute({ worktreeId });
    expect(stalePaths(files, otherWorktreeId)).toEqual([]);
  });
});

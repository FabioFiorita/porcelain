import { ReviewedFileStore } from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';
import { InvalidateReviewedMarksService } from './invalidate-reviewed-marks-service.ts';

const worktreeId = 'a'.repeat(64);
const otherWorktreeId = 'b'.repeat(64);

async function setup() {
  const files = new InMemoryReviewedFileStore();
  for (const id of [worktreeId, otherWorktreeId]) {
    for (const path of ['src/app.ts', 'src/app.tsx', 'srcs/x.ts', 'README.md'])
      await Effect.runPromise(
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
        }),
      );
  }
  return {
    files,
    service: Effect.runSync(
      InvalidateReviewedMarksService.pipe(
        Effect.provide(InvalidateReviewedMarksService.layer),
        Effect.provideService(ReviewedFileStore, files),
      ),
    ),
  };
}

const stalePaths = async (store: InMemoryReviewedFileStore, id: string) =>
  (await Effect.runPromise(store.list({ worktreeId: id })))
    .filter((mark) => mark.stale)
    .map((mark) => mark.path);

describe('InvalidateReviewedMarksService', () => {
  it('makes stale the marks at a changed path or under a changed directory', async () => {
    const { service, files } = await setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, paths: ['src'] })),
    ).toEqual({
      changed: true,
    });
    expect(await stalePaths(files, worktreeId)).toEqual([
      'src/app.ts',
      'src/app.tsx',
    ]);
  });

  it('does not treat a shared name prefix as a directory', async () => {
    const { service, files } = await setup();
    Effect.runSync(service.execute({ worktreeId, paths: ['src/app.ts'] }));
    expect(await stalePaths(files, worktreeId)).toEqual(['src/app.ts']);
  });

  it('makes every mark stale when the changed paths are unknown', async () => {
    const { service, files } = await setup();
    Effect.runSync(service.execute({ worktreeId }));
    expect(await stalePaths(files, worktreeId)).toHaveLength(4);
  });

  it('reports no change once every touched mark is already stale', async () => {
    const { service } = await setup();
    Effect.runSync(service.execute({ worktreeId }));
    expect(Effect.runSync(service.execute({ worktreeId }))).toEqual({
      changed: false,
    });
  });

  it('changes nothing for an empty list of paths', async () => {
    const { service, files } = await setup();
    expect(Effect.runSync(service.execute({ worktreeId, paths: [] }))).toEqual({
      changed: false,
    });
    expect(await stalePaths(files, worktreeId)).toEqual([]);
  });

  it('leaves other worktrees alone', async () => {
    const { service, files } = await setup();
    Effect.runSync(service.execute({ worktreeId }));
    expect(await stalePaths(files, otherWorktreeId)).toEqual([]);
  });
});

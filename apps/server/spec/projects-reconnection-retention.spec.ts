import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { NodeServices } from '@effect/platform-node';
import { Clock, Effect, Layer, ManagedRuntime } from 'effect';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vite-plus/test';
import { testClock } from '@porcelain/kernel/test-kit';
import { SequentialIdSource } from '@porcelain/kernel/fakes';
import { IdSource } from '@porcelain/kernel/ports';
import {
  InventoryStore,
  WorktreePresenceStore,
  CollectAbsentWorktreesOptions,
} from '@porcelain/projects/ports';
import {
  RegisterProjectService,
  RecordWorktreePresenceService,
  CollectAbsentWorktreesService,
} from '@porcelain/projects/services';
import type { RegisteredProject } from '@porcelain/projects/models';
import { ReviewedFileStore } from '@porcelain/reviews/ports';
import { storageLayer } from '@porcelain/storage';

it('preserves original marks beyond the absence grace period and a restart, then restores ordinary collection when that identity returns', async () => {
  const directory = mkdtempSync(
    join(temporaryRoot, 'porcelain-reconnect-retention-'),
  );
  const clock = await testClock('2026-09-01T00:00:00.000Z');
  const options = { worktreeIdLength: 32, busyTimeoutMs: 5000 };
  const open = () =>
    ManagedRuntime.make(
      Layer.mergeAll(
        RegisterProjectService.layer,
        RecordWorktreePresenceService.layer,
        CollectAbsentWorktreesService.layer,
      ).pipe(
        Layer.provideMerge(storageLayer(directory, options)),
        Layer.provide(Layer.succeed(IdSource, new SequentialIdSource())),
        Layer.provide(Layer.succeed(Clock.Clock, clock)),
        Layer.provide(
          Layer.succeed(CollectAbsentWorktreesOptions, {
            graceMs: 30 * 24 * 60 * 60 * 1000,
          }),
        ),
        Layer.provide(NodeServices.layer),
      ),
    );
  let runtime = open();
  const project: RegisteredProject = {
    id: 'project',
    name: 'api',
    namedByOwner: false,
    commonDirectory: '/repo/.git',
    repositoryIdentity: 'original',
    available: false,
    position: 1,
  };
  const marks = [
    {
      path: 'README.md',
      fingerprint: 'original-content',
      reviewedAt: '2026-09-01',
      stale: false,
    },
  ];
  const register = (identity: string) =>
    runtime.runPromise(
      Effect.gen(function* () {
        return yield* (yield* RegisterProjectService).execute({
          repository: {
            commonDirectory: project.commonDirectory,
            repositoryIdentity: identity,
            worktrees: [{ path: '/repo', main: true, available: true }],
          },
          originUrl: undefined,
          reconnectProjectId: project.id,
        });
      }),
    );
  const record = (identity: string, ids: string[]) =>
    runtime.runPromise(
      Effect.gen(function* () {
        yield* (yield* RecordWorktreePresenceService).execute({
          worktrees: {
            projectId: project.id,
            available: true,
            complete: true,
            worktrees: ids.map((id) => ({
              id,
              projectId: project.id,
              path: `/repo/${id}`,
              branch: undefined,
              main: true,
              available: true,
              metadataIdentity: id,
              administrativeDirectory: `/repo/.git/${id}`,
              commonDirectory: project.commonDirectory,
              repositoryIdentity: identity,
              repositoryId: identity,
            })),
          },
        });
      }),
    );
  const collect = (worktreeIds: string[]) =>
    runtime.runPromise(
      Effect.gen(function* () {
        return yield* (yield* CollectAbsentWorktreesService).execute({
          worktreeIds,
        });
      }),
    );
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        yield* (yield* InventoryStore).save(project);
        yield* (yield* WorktreePresenceStore).save({
          rows: [
            {
              worktreeId: 'original',
              projectId: project.id,
              missingSince: undefined,
            },
          ],
        });
        yield* (yield* ReviewedFileStore).save({
          worktreeId: 'original',
          marks,
        });
      }),
    );
    await register('replacement');
    await record('replacement', ['replacement', 'removed-replacement']);
    await record('replacement', ['replacement']);
    await Effect.runPromise(
      clock.setTime(Date.parse('2026-11-01T00:00:00.000Z')),
    );
    await runtime.dispose();
    runtime = open();
    expect(await collect(['original', 'removed-replacement'])).toEqual({
      collected: ['removed-replacement'],
    });
    expect(
      await runtime.runPromise(
        Effect.flatMap(ReviewedFileStore, (store) =>
          store.list({ worktreeId: 'original' }),
        ),
      ),
    ).toEqual(marks);
    const current = await runtime.runPromise(
      Effect.flatMap(InventoryStore, (store) =>
        store.find({ projectId: project.id }),
      ),
    );
    if (!current) throw new Error('The project was not registered');
    await runtime.runPromise(
      Effect.flatMap(InventoryStore, (store) =>
        store.save({ ...current, available: false }),
      ),
    );
    await register('original');
    await record('original', ['original']);
    expect(
      await runtime.runPromise(
        Effect.flatMap(ReviewedFileStore, (store) =>
          store.list({ worktreeId: 'original' }),
        ),
      ),
    ).toEqual(marks);
    await record('original', []);
    await Effect.runPromise(
      clock.setTime(Date.parse('2027-01-01T00:00:00.000Z')),
    );
    expect(await collect(['original'])).toEqual({ collected: ['original'] });
    expect(
      await runtime.runPromise(
        Effect.flatMap(ReviewedFileStore, (store) =>
          store.list({ worktreeId: 'original' }),
        ),
      ),
    ).toEqual([]);
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

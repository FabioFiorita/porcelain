import { testClock } from '@porcelain/kernel/test-kit';
import {
  type ListedWorktree,
  type RegisteredProject,
  type WorktreeActivityTarget,
} from '@porcelain/projects/models';
import {
  CheckWorktreeOptions,
  InventoryStore,
  WorktreeActivityReader,
  WorktreeCatalogStore,
} from '@porcelain/projects/ports';
import {
  CheckRefreshedWorktreeService,
  CheckWorktreeService,
  ListKnownWorktreesService,
  ListProjectWorktreesService,
  ListRegisteredProjectsService,
  ReadWorktreeActivityService,
  RecordWorktreeActivityService,
  RecordWorktreeCatalogService,
  RecordWorktreePresenceService,
  UpdateProjectAvailabilityService,
} from '@porcelain/projects/services';
import { Clock, Deferred, Effect, Fiber, Layer } from 'effect';
import { expect, it } from 'vitest';
import { InMemoryInventoryStore } from '../../../spec/fakes/in-memory-inventory-store.ts';
import { InMemoryWorktreeCatalogStore } from '../../../spec/fakes/in-memory-worktree-catalog-store.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { InventoryScan } from '../../ports/inventory-scan.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { CheckWorktreeUseCase } from './check-worktree.ts';
import { ScanInventoryUseCase } from './scan-inventory.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'repository-1',
  available: true,
  position: 1,
};

const feature: ListedWorktree = {
  id: 'feature',
  projectId: project.id,
  path: '/srv/api-feature',
  branch: 'refs/heads/feature',
  main: false,
  available: true,
  metadataIdentity: 'metadata-feature',
  administrativeDirectory: '/srv/api/.git/worktrees/feature',
  commonDirectory: project.commonDirectory,
  repositoryIdentity: project.repositoryIdentity,
  repositoryId: project.repositoryIdentity,
};

it('publishes usable inventory while activity is held and opens a worktree after the freshness window', async () => {
  const catalog = new InMemoryWorktreeCatalogStore();
  const notices: (string | undefined)[] = [];
  const clock = await testClock('2026-11-18T23:00:00.000Z');
  const { answer, opened } = await Effect.runPromise(
    Effect.gen(function* () {
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const reader: WorktreeActivityReader = {
        read: (targets: readonly WorktreeActivityTarget[]) =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.as(
              targets.map((target) => ({
                ...target,
                activity: {
                  kind: 'dated' as const,
                  at: '2026-11-18T22:59:00.000Z',
                },
              })),
            ),
          ),
      };
      const ports = Layer.mergeAll(
        Layer.succeed(WorktreeCatalogStore, catalog),
        Layer.succeed(InventoryStore, new InMemoryInventoryStore([project])),
        Layer.succeed(WorktreeActivityReader, reader),
        Layer.succeed(Clock.Clock, clock),
        Layer.succeed(CheckWorktreeOptions, { staleAfterMs: 200 }),
      );
      const services = Layer.mergeAll(
        CheckRefreshedWorktreeService.layer,
        CheckWorktreeService.layer,
        ListRegisteredProjectsService.layer,
        ListKnownWorktreesService.layer,
        RecordWorktreeCatalogService.layer,
        ReadWorktreeActivityService.layer,
        RecordWorktreeActivityService.layer,
        Layer.succeed(ListProjectWorktreesService, {
          execute: () =>
            Effect.succeed({
              projectId: project.id,
              available: true as const,
              complete: true,
              worktrees: [feature],
            }),
        }),
        Layer.succeed(UpdateProjectAvailabilityService, {
          execute: () => Effect.void,
        }),
        Layer.succeed(RecordWorktreePresenceService, {
          execute: () => Effect.void,
        }),
      ).pipe(Layer.provideMerge(ports));
      const lanes = Lanes.layer.pipe(
        Layer.provide(
          Layer.succeed(LaneOptions, {
            readCapacity: 2,
            deadlineMs: 10_000,
            consistency: { execute: () => Effect.void },
          }),
        ),
      );
      const layer = ScanInventoryUseCase.layer.pipe(
        Layer.provideMerge(Layer.mergeAll(services, lanes, LaneKeys.layer)),
        Layer.provideMerge(
          Layer.succeed(EventPublisher, {
            inventoryChanged: (change?: 'activity') =>
              Effect.sync(() => {
                notices.push(change);
              }),
            projectChanged: () => Effect.void,
            worktreeChanged: () => Effect.void,
            filesChanged: () => Effect.void,
            gitActionProgressed: () => Effect.void,
            gitActionChanged: () => Effect.void,
          }),
        ),
      );
      return yield* Effect.gen(function* () {
        const scan = yield* ScanInventoryUseCase;
        const laneKeys = yield* LaneKeys;
        const lanesCapability = yield* Lanes;
        const known = yield* ListKnownWorktreesService;
        const check = yield* CheckWorktreeUseCase.pipe(
          Effect.provide(CheckWorktreeUseCase.layer),
          Effect.provideService(InventoryScan, scan),
        );
        const opening = yield* Effect.forkChild(
          Effect.result(
            check.execute({
              worktreeId: 'feature',
              requireAvailableProject: false,
            }),
          ),
        );
        yield* Deferred.await(entered);
        const whileHeld = yield* lanesCapability
          .run(laneKeys.inventory(), 'read', () =>
            known.execute({ projects: [project] }),
          )
          .pipe(Effect.timeout('2 seconds'));
        yield* clock.adjust('201 millis');
        yield* Deferred.succeed(release, undefined);
        return {
          answer: whileHeld.listings[0]?.worktrees.map(
            (worktree) => worktree.id,
          ),
          opened: yield* Fiber.join(opening),
        };
      }).pipe(Effect.provide(layer));
    }),
  );
  expect(answer).toEqual(['feature']);
  expect(opened).toMatchObject({
    _tag: 'Success',
    success: { id: 'feature', available: true },
  });
  expect(
    catalog.lastSeen({ projectId: project.id })[0]?.uncommittedChangedAt,
  ).toBe('2026-11-18T22:59:00.000Z');
  expect(notices).toEqual([undefined, 'activity']);
});

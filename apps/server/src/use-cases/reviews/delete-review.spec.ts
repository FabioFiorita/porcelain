import { expect, it } from '@effect/vitest';
import { Context, Effect, Layer } from 'effect';
import { ReviewStore } from '@porcelain/reviews/ports';
import { DeleteReviewService } from '@porcelain/reviews/services';
import { type Review } from '@porcelain/reviews/models';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { WorktreeConsistencyProbe } from '../../ports/worktree-consistency-probe.ts';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { DeleteReviewUseCase } from './delete-review.ts';

it.effect(
  'announces the review only after deletion and stays quiet on a repeated delete',
  () =>
    Effect.gen(function* () {
      const worktree = {
        id: 'one',
        projectId: 'project',
        repositoryId: 'repository',
        path: '/repo',
        branch: 'main',
        main: true,
        available: true,
        metadataIdentity: 'metadata',
        administrativeDirectory: '/repo/.git',
        commonDirectory: '/repo/.git',
        repositoryIdentity: 'identity',
      };
      let review: Review | undefined = {
        worktreeId: 'one',
        revision: 3,
        publishedAt: 'today',
        active: true,
        summaryHtml: 'Review',
        summaryToken: 'token',
        summarySecret: 'secret',
        layers: [],
      };
      const removedWorktrees: string[] = [];
      const reviewsAtNotice: (Review | undefined)[] = [];
      const store = ReviewStore.of({
        read: () => Effect.sync(() => review),
        remove: ({ worktreeId }) =>
          Effect.sync(() => {
            removedWorktrees.push(worktreeId);
            const deleted = review !== undefined;
            review = undefined;
            return deleted;
          }),
        byWorktrees: () => Effect.die('Unexpected bulk read'),
        findSummary: () => Effect.die('Unexpected summary read'),
        save: () => Effect.die('Unexpected publish'),
        readProofFile: () => Effect.die('Unexpected proof read'),
        setActive: () => Effect.die('Unexpected activity update'),
      });
      const consistency = { execute: () => Effect.void };
      const laneContext = yield* Layer.build(
        Lanes.layer.pipe(
          Layer.provide(
            Layer.succeed(LaneOptions, {
              readCapacity: 2,
              deadlineMs: 1000,
              consistency,
            }),
          ),
        ),
      );
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () => Effect.succeed(worktree),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, Context.get(laneContext, Lanes)),
        Effect.provideService(
          LaneKeys,
          yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer)),
        ),
      );
      const notices: unknown[] = [];
      const events: EventPublisher = {
        inventoryChanged: () => Effect.void,
        projectChanged: () => Effect.void,
        filesChanged: () => Effect.void,
        gitActionChanged: () => Effect.void,
        worktreeChanged: (notice) =>
          Effect.gen(function* () {
            reviewsAtNotice.push(yield* store.read({ worktreeId: 'one' }));
            notices.push(notice);
          }),
      };
      const remove = yield* DeleteReviewService.pipe(
        Effect.provide(DeleteReviewService.layer),
        Effect.provideService(ReviewStore, store),
      );
      const useCase = yield* DeleteReviewUseCase.pipe(
        Effect.provide(DeleteReviewUseCase.layer),
        Effect.provideService(WorktreeAccess, access),
        Effect.provideService(DeleteReviewService, remove),
        Effect.provideService(EventPublisher, events),
      );
      expect(yield* useCase.execute({ worktreeId: 'one' })).toEqual({
        deleted: true,
      });
      expect(notices).toEqual([{ worktreeId: 'one', change: 'review' }]);
      expect(yield* useCase.execute({ worktreeId: 'one' })).toEqual({
        deleted: false,
      });
      expect(notices).toEqual([{ worktreeId: 'one', change: 'review' }]);
      expect(removedWorktrees).toEqual(['one', 'one']);
      expect(reviewsAtNotice).toEqual([undefined]);
    }).pipe(Effect.scoped),
);

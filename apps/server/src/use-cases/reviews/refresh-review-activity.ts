import {
  ListKnownWorktreesService,
  ListRegisteredProjectsService,
} from '@porcelain/projects/services';
import { Logger } from '../../ports/logger.ts';
import { Cause, Effect, Context, Layer } from 'effect';
import { RefreshWorktreeReviewUseCasePort } from '../../ports/refresh-worktree-review-use-case-port.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RefreshReviewActivityUseCase extends Context.Service<
  RefreshReviewActivityUseCase,
  { readonly execute: () => Effect.Effect<void> }
>()('@porcelain/server/RefreshReviewActivityUseCase') {
  static readonly layer = Layer.effect(
    RefreshReviewActivityUseCase,
    Effect.gen(function* () {
      const listRegisteredProjectsCapability =
        yield* ListRegisteredProjectsService;
      const listKnownWorktreesCapability = yield* ListKnownWorktreesService;
      const refreshWorktreeReviewCapability =
        yield* RefreshWorktreeReviewUseCasePort;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const loggerCapability = yield* Logger;

      return {
        execute: Effect.fn('RefreshReviewActivityUseCase.execute')(
          function* (): Effect.fn.Return<void> {
            const { listings } = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'read',
              () =>
                Effect.gen(function* () {
                  const projects =
                    yield* listRegisteredProjectsCapability.execute();
                  return yield* listKnownWorktreesCapability.execute(projects);
                }),
            );
            yield* Effect.forEach(
              listings
                .flatMap((listing) => listing.worktrees)
                .filter((worktree) => worktree.available),
              (worktree) =>
                refreshWorktreeReviewCapability
                  .execute({ worktreeId: worktree.id })
                  .pipe(
                    Effect.catchCause((cause) =>
                      Cause.hasInterruptsOnly(cause)
                        ? Effect.interrupt
                        : Effect.sync(() =>
                            loggerCapability.failure({
                              kind: 'review-refresh',
                              worktreeId: worktree.id,
                              error: Cause.squash(cause),
                            }),
                          ),
                    ),
                  ),
              { concurrency: 'unbounded' },
            );
          },
        ),
      };
    }),
  );
}

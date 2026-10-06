import { Effect, Context, Layer } from 'effect';
import { type ReviewBadges } from '@porcelain/kernel/models';
import { type ReadInventoryBadgesInput } from '../../ports/read-inventory-badges-use-case-port.ts';
import { ReadTextFilesService } from '@porcelain/files/services';
import { type ReviewTexts } from '@porcelain/reviews/models';
import {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadInventoryBadgesUseCase extends Context.Service<
  ReadInventoryBadgesUseCase,
  {
    readonly execute: (
      input: ReadInventoryBadgesInput,
    ) => Effect.Effect<ReviewBadges>;
  }
>()('@porcelain/server/ReadInventoryBadgesUseCase') {
  static readonly layer = Layer.effect(
    ReadInventoryBadgesUseCase,
    Effect.gen(function* () {
      const accessCapability = yield* WorktreeAccess;
      const pathsCapability = yield* ListReviewedLayerPathsService;
      const textsCapability = yield* ReadTextFilesService;
      const statusesCapability = yield* ReadReviewBadgesService;
      const lanesCapability = yield* Lanes;
      const keysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadInventoryBadgesUseCase.execute')(function* (
          input: ReadInventoryBadgesInput,
        ): Effect.fn.Return<ReviewBadges> {
          return yield* Effect.forEach(
            input.listings,
            ({ worktrees }) => {
              const [first] = worktrees;
              if (!first) return Effect.succeed<ReviewBadges>(new Map());
              return Effect.gen(function* () {
                const pathsByWorktree = yield* lanesCapability.run(
                  keysCapability.reviews(first),
                  'read',
                  () =>
                    Effect.forEach(worktrees, (worktree) =>
                      pathsCapability
                        .execute({ worktreeId: worktree.id })
                        .pipe(
                          Effect.map(
                            ({ paths }) => [worktree.id, paths] as const,
                          ),
                        ),
                    ),
                );
                const paths = new Map(pathsByWorktree);
                const pairs = yield* Effect.forEach(
                  worktrees,
                  (worktree) =>
                    Effect.gen(function* () {
                      const texts = accessCapability
                        .read(worktree.id, () =>
                          textsCapability.execute({
                            worktreeId: worktree.id,
                            paths: paths.get(worktree.id) ?? [],
                          }),
                        )
                        .pipe(
                          Effect.map((read): ReviewTexts => read.texts),
                          Effect.orElseSucceed((): ReviewTexts => new Map()),
                        );
                      return [worktree.id, yield* texts] as const;
                    }),
                  { concurrency: 'unbounded' },
                );
                return yield* lanesCapability.run(
                  keysCapability.reviews(first),
                  'read',
                  () =>
                    statusesCapability
                      .execute({
                        worktreeIds: worktrees.map((worktree) => worktree.id),
                        texts: new Map(pairs),
                      })
                      .pipe(Effect.map(({ statuses }) => statuses)),
                );
              });
            },
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.map(
              (badges) => new Map(badges.flatMap((statuses) => [...statuses])),
            ),
          );
        }),
      };
    }),
  );
}

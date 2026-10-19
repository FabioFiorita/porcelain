import { Effect, Context, Layer } from 'effect';
import { type ReviewBadges } from '@porcelain/kernel/models';
import { type ReadInventoryBadgesInput } from '../../ports/read-inventory-badges-use-case-port.ts';
import { ReadReviewBadgesService } from '@porcelain/reviews/services';
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
              return lanesCapability.run(
                keysCapability.reviews(first),
                'read',
                () =>
                  statusesCapability
                    .execute({
                      worktreeIds: worktrees.map((worktree) => worktree.id),
                    })
                    .pipe(Effect.map(({ statuses }) => statuses)),
              );
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

import { Effect, Context, Layer } from 'effect';
import {
  CollectAbsentWorktreesService,
  ListExpiredWorktreesService,
} from '@porcelain/projects/services';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class CollectAbsentWorktreesUseCase extends Context.Service<
  CollectAbsentWorktreesUseCase,
  { readonly execute: () => Effect.Effect<void> }
>()('@porcelain/server/CollectAbsentWorktreesUseCase') {
  static readonly layer = Layer.effect(
    CollectAbsentWorktreesUseCase,
    Effect.gen(function* () {
      const listExpiredWorktreesCapability = yield* ListExpiredWorktreesService;
      const collectAbsentWorktreesCapability =
        yield* CollectAbsentWorktreesService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('CollectAbsentWorktreesUseCase.execute')(
          function* (): Effect.fn.Return<void> {
            const { worktrees } = yield* lanesCapability.run(
              laneKeysCapability.inventory(),
              'read',
              () => listExpiredWorktreesCapability.execute(),
            );
            const collected: string[] = [];
            for (const worktree of worktrees) {
              const result = yield* lanesCapability.run(
                laneKeysCapability.repository(worktree),
                'write',
                () =>
                  collectAbsentWorktreesCapability.execute({
                    worktreeIds: [worktree.id],
                  }),
              );
              collected.push(...result.collected);
            }
            if (collected.length > 0)
              yield* eventsCapability.inventoryChanged();
          },
        ),
      };
    }),
  );
}

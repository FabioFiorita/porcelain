import { Context, Effect, Layer } from 'effect';
import { RenameEnvironmentService } from '@porcelain/access/services';
import {
  type RenameEnvironmentRequest,
  type RenameEnvironmentResponse,
} from '@porcelain/contracts/access';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RenameEnvironmentUseCase extends Context.Service<
  RenameEnvironmentUseCase,
  {
    readonly execute: (
      input: RenameEnvironmentRequest,
    ) => Effect.Effect<RenameEnvironmentResponse>;
  }
>()('@porcelain/server/RenameEnvironmentUseCase') {
  static readonly layer = Layer.effect(
    RenameEnvironmentUseCase,
    Effect.gen(function* () {
      const renameEnvironmentCapability = yield* RenameEnvironmentService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('RenameEnvironmentUseCase.execute')(function* (
          input: RenameEnvironmentRequest,
        ): Effect.fn.Return<RenameEnvironmentResponse> {
          return yield* lanesCapability.commit(
            laneKeysCapability.access(),
            () =>
              Effect.uninterruptible(
                renameEnvironmentCapability.execute({
                  name: input.name ?? undefined,
                }),
              ),
            () => eventsCapability.inventoryChanged(),
          );
        }),
      };
    }),
  );
}

import { Context, Effect, Layer } from 'effect';
import { SetEnvironmentIconService } from '@porcelain/access/services';
import {
  type SetEnvironmentIconRequest,
  type SetEnvironmentIconResponse,
} from '@porcelain/contracts/access';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetEnvironmentIconUseCase extends Context.Service<
  SetEnvironmentIconUseCase,
  {
    readonly execute: (
      input: SetEnvironmentIconRequest,
    ) => Effect.Effect<SetEnvironmentIconResponse>;
  }
>()('@porcelain/server/SetEnvironmentIconUseCase') {
  static readonly layer = Layer.effect(
    SetEnvironmentIconUseCase,
    Effect.gen(function* () {
      const setEnvironmentIconCapability = yield* SetEnvironmentIconService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const eventsCapability = yield* EventPublisher;

      return {
        execute: Effect.fn('SetEnvironmentIconUseCase.execute')(function* (
          input: SetEnvironmentIconRequest,
        ): Effect.fn.Return<SetEnvironmentIconResponse> {
          return yield* lanesCapability.commit(
            laneKeysCapability.access(),
            () =>
              Effect.uninterruptible(
                setEnvironmentIconCapability.execute({
                  icon: input.icon ?? undefined,
                }),
              ),
            () => eventsCapability.inventoryChanged(),
          );
        }),
      };
    }),
  );
}

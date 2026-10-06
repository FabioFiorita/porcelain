import { Context, Effect, Layer } from 'effect';
import { FlushDeviceActivityService } from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class FlushDeviceActivityUseCase extends Context.Service<
  FlushDeviceActivityUseCase,
  { readonly execute: () => Effect.Effect<void, never> }
>()('@porcelain/server/FlushDeviceActivityUseCase') {
  static readonly layer = Layer.effect(
    FlushDeviceActivityUseCase,
    Effect.gen(function* () {
      const flushDeviceActivityCapability = yield* FlushDeviceActivityService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('FlushDeviceActivityUseCase.execute')(
          function* (): Effect.fn.Return<void, never> {
            return yield* lanesCapability.run(
              laneKeysCapability.access(),
              'write',
              () =>
                Effect.gen(function* () {
                  return yield* flushDeviceActivityCapability.execute();
                }),
            );
          },
        ),
      };
    }),
  );
}

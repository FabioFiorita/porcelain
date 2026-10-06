import { Context, Effect, Layer } from 'effect';
import { ReadOwnerStatusService } from '@porcelain/access/services';
import { type ReadOwnerStatusResponse } from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadOwnerStatusUseCase extends Context.Service<
  ReadOwnerStatusUseCase,
  { readonly execute: () => Effect.Effect<ReadOwnerStatusResponse, never> }
>()('@porcelain/server/ReadOwnerStatusUseCase') {
  static readonly layer = Layer.effect(
    ReadOwnerStatusUseCase,
    Effect.gen(function* () {
      const readOwnerStatusCapability = yield* ReadOwnerStatusService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadOwnerStatusUseCase.execute')(
          function* (): Effect.fn.Return<ReadOwnerStatusResponse, never> {
            return yield* lanesCapability.run(
              laneKeysCapability.access(),
              'read',
              () =>
                Effect.gen(function* () {
                  return yield* readOwnerStatusCapability.execute();
                }),
            );
          },
        ),
      };
    }),
  );
}

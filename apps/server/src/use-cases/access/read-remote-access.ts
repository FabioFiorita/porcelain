import { Context, Effect, Layer } from 'effect';
import { ReadRemoteAccessService } from '@porcelain/access/services';
import { type ReadRemoteAccessResponse } from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadRemoteAccessUseCase extends Context.Service<
  ReadRemoteAccessUseCase,
  { readonly execute: () => Effect.Effect<ReadRemoteAccessResponse, never> }
>()('@porcelain/server/ReadRemoteAccessUseCase') {
  static readonly layer = Layer.effect(
    ReadRemoteAccessUseCase,
    Effect.gen(function* () {
      const readRemoteAccessCapability = yield* ReadRemoteAccessService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadRemoteAccessUseCase.execute')(
          function* (): Effect.fn.Return<ReadRemoteAccessResponse, never> {
            return yield* lanesCapability.run(
              laneKeysCapability.remoteAccess(),
              'read',
              () =>
                Effect.gen(function* () {
                  return yield* readRemoteAccessCapability.execute();
                }),
            );
          },
        ),
      };
    }),
  );
}

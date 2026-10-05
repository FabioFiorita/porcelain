import { Context, Effect, Layer } from 'effect';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import {
  OpenRemoteRoutesService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class CloseRemoteRoutesUseCase extends Context.Service<
  CloseRemoteRoutesUseCase,
  {
    readonly execute: () => Effect.Effect<
      void,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/CloseRemoteRoutesUseCase') {
  static readonly layer = Layer.effect(
    CloseRemoteRoutesUseCase,
    Effect.gen(function* () {
      const openRemoteRoutesCapability = yield* OpenRemoteRoutesService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('CloseRemoteRoutesUseCase.execute')(
          function* (): Effect.fn.Return<
            void,
            MissingEnvironmentIdentityError
          > {
            return yield* lanesCapability.run(
              laneKeysCapability.remoteAccess(),
              'write',
              () =>
                Effect.gen(function* () {
                  return yield* openRemoteRoutesCapability.execute({
                    ...(yield* readEnvironmentCapability.execute()),
                    closing: true,
                  });
                }),
            );
          },
        ),
      };
    }),
  );
}

import { Context, Effect, Layer } from 'effect';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import {
  CloseTunnelConnectionsService,
  OpenRemoteRoutesService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class OpenRemoteRoutesUseCase extends Context.Service<
  OpenRemoteRoutesUseCase,
  {
    readonly execute: () => Effect.Effect<
      void,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/OpenRemoteRoutesUseCase') {
  static readonly layer = Layer.effect(
    OpenRemoteRoutesUseCase,
    Effect.gen(function* () {
      const openRemoteRoutesCapability = yield* OpenRemoteRoutesService;
      const closeTunnelConnectionsCapability =
        yield* CloseTunnelConnectionsService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('OpenRemoteRoutesUseCase.execute')(
          function* (): Effect.fn.Return<
            void,
            MissingEnvironmentIdentityError
          > {
            return yield* lanesCapability.run(
              laneKeysCapability.remoteAccess(),
              'write',
              () =>
                Effect.gen(function* () {
                  yield* openRemoteRoutesCapability.execute(
                    yield* readEnvironmentCapability.execute(),
                  );
                  yield* closeTunnelConnectionsCapability.execute();
                }),
            );
          },
        ),
      };
    }),
  );
}

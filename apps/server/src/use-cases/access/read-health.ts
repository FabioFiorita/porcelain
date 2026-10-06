import { Context, Effect, Layer } from 'effect';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import { ReadEnvironmentService } from '@porcelain/access/services';
import { type ReadHealthResponse } from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadHealthUseCase extends Context.Service<
  ReadHealthUseCase,
  {
    readonly execute: () => Effect.Effect<
      ReadHealthResponse,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/ReadHealthUseCase') {
  static readonly layer = Layer.effect(
    ReadHealthUseCase,
    Effect.gen(function* () {
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ReadHealthUseCase.execute')(
          function* (): Effect.fn.Return<
            ReadHealthResponse,
            MissingEnvironmentIdentityError
          > {
            return yield* lanesCapability.run(
              laneKeysCapability.access(),
              'read',
              () =>
                Effect.gen(function* () {
                  const { environmentId } =
                    yield* readEnvironmentCapability.execute();
                  return { status: 'ok' as const, environmentId };
                }),
            );
          },
        ),
      };
    }),
  );
}

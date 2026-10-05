import { ReadEnvironmentUseCaseOptions } from '../../ports/read-environment-use-case-options.ts';
import { Context, Effect, Layer } from 'effect';
import { type MissingEnvironmentIdentityError } from '@porcelain/access/errors';
import {
  ReadEnvironmentNameService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import { type ReadEnvironmentResponse } from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ReadEnvironmentUseCase extends Context.Service<
  ReadEnvironmentUseCase,
  {
    readonly execute: () => Effect.Effect<
      ReadEnvironmentResponse,
      MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/ReadEnvironmentUseCase') {
  static readonly layer = Layer.effect(
    ReadEnvironmentUseCase,
    Effect.gen(function* () {
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const readEnvironmentNameCapability = yield* ReadEnvironmentNameService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;
      const optionsCapability = yield* ReadEnvironmentUseCaseOptions;

      return {
        execute: Effect.fn('ReadEnvironmentUseCase.execute')(
          function* (): Effect.fn.Return<
            ReadEnvironmentResponse,
            MissingEnvironmentIdentityError
          > {
            return yield* lanesCapability.run(
              laneKeysCapability.access(),
              'read',
              () =>
                Effect.gen(function* () {
                  return {
                    environmentId: (yield* readEnvironmentCapability.execute())
                      .environmentId,
                    name: (yield* readEnvironmentNameCapability.execute()).name,
                    version: optionsCapability.version,
                    protocol: optionsCapability.protocol,
                  };
                }),
            );
          },
        ),
      };
    }),
  );
}

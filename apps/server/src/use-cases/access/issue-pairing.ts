import { Context, Effect, Layer } from 'effect';
import {
  type InvalidPairingAddressError,
  type InvalidDeviceDetailsError,
  type MissingEnvironmentIdentityError,
} from '@porcelain/access/errors';
import {
  IssuePairingService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import {
  type IssuePairingRequest,
  type IssuePairingResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class IssuePairingUseCase extends Context.Service<
  IssuePairingUseCase,
  {
    readonly execute: (
      input: IssuePairingRequest,
    ) => Effect.Effect<
      IssuePairingResponse,
      | InvalidPairingAddressError
      | InvalidDeviceDetailsError
      | MissingEnvironmentIdentityError
    >;
  }
>()('@porcelain/server/IssuePairingUseCase') {
  static readonly layer = Layer.effect(
    IssuePairingUseCase,
    Effect.gen(function* () {
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const issuePairingCapability = yield* IssuePairingService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('IssuePairingUseCase.execute')(function* (
          input: IssuePairingRequest,
        ): Effect.fn.Return<
          IssuePairingResponse,
          | InvalidPairingAddressError
          | InvalidDeviceDetailsError
          | MissingEnvironmentIdentityError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                const { environmentId } =
                  yield* readEnvironmentCapability.execute();
                return yield* issuePairingCapability.execute({
                  ...input,
                  environmentId,
                });
              }),
          );
        }),
      };
    }),
  );
}

import { Context, Effect, Layer, Redacted } from 'effect';
import {
  type SharingManagementRequiredError,
  type InvalidPairingAddressError,
  type InvalidDeviceDetailsError,
  type MissingEnvironmentIdentityError,
} from '@porcelain/access/errors';
import {
  AuthorizeSharingService,
  IssuePairingService,
  ReadEnvironmentService,
} from '@porcelain/access/services';
import {
  type IssuePairingInput,
  type IssuePairingResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class IssuePairingUseCase extends Context.Service<
  IssuePairingUseCase,
  {
    readonly execute: (
      input: IssuePairingInput,
    ) => Effect.Effect<
      IssuePairingResponse,
      | InvalidPairingAddressError
      | InvalidDeviceDetailsError
      | MissingEnvironmentIdentityError
      | SharingManagementRequiredError
    >;
  }
>()('@porcelain/server/IssuePairingUseCase') {
  static readonly layer = Layer.effect(
    IssuePairingUseCase,
    Effect.gen(function* () {
      const authorizeSharing = yield* AuthorizeSharingService;
      const readEnvironmentCapability = yield* ReadEnvironmentService;
      const issuePairingCapability = yield* IssuePairingService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('IssuePairingUseCase.execute')(function* (
          input: IssuePairingInput,
        ): Effect.fn.Return<
          IssuePairingResponse,
          | InvalidPairingAddressError
          | InvalidDeviceDetailsError
          | MissingEnvironmentIdentityError
          | SharingManagementRequiredError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                yield* authorizeSharing.execute(input);
                const { environmentId } =
                  yield* readEnvironmentCapability.execute();
                const issued = yield* issuePairingCapability.execute({
                  ...input,
                  environmentId,
                });
                return {
                  grants: issued.grants.map(({ grant, code, link }) => ({
                    grant,
                    code: Redacted.value(code),
                    link: { ...link, code: Redacted.value(link.code) },
                  })),
                };
              }),
          );
        }),
      };
    }),
  );
}

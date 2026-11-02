import { Context, Effect, Layer } from 'effect';
import {
  type SharingManagementRequiredError,
  type DeviceNotFoundError,
} from '@porcelain/access/errors';
import {
  AuthorizeSharingService,
  SetDeviceTrustService,
} from '@porcelain/access/services';
import {
  type SetDeviceTrustInput,
  type SetDeviceTrustResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetDeviceTrustUseCase extends Context.Service<
  SetDeviceTrustUseCase,
  {
    readonly execute: (
      input: SetDeviceTrustInput,
    ) => Effect.Effect<
      SetDeviceTrustResponse,
      DeviceNotFoundError | SharingManagementRequiredError
    >;
  }
>()('@porcelain/server/SetDeviceTrustUseCase') {
  static readonly layer = Layer.effect(
    SetDeviceTrustUseCase,
    Effect.gen(function* () {
      const authorizeSharing = yield* AuthorizeSharingService;
      const setDeviceTrustCapability = yield* SetDeviceTrustService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('SetDeviceTrustUseCase.execute')(function* (
          input: SetDeviceTrustInput,
        ): Effect.fn.Return<
          SetDeviceTrustResponse,
          DeviceNotFoundError | SharingManagementRequiredError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                yield* authorizeSharing.execute(input);
                return yield* setDeviceTrustCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}

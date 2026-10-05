import { Context, Effect, Layer } from 'effect';
import { type DeviceNotFoundError } from '@porcelain/access/errors';
import { SetDeviceTrustService } from '@porcelain/access/services';
import {
  type SetDeviceTrustRequest,
  type SetDeviceTrustResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetDeviceTrustUseCase extends Context.Service<
  SetDeviceTrustUseCase,
  {
    readonly execute: (
      input: SetDeviceTrustRequest,
    ) => Effect.Effect<SetDeviceTrustResponse, DeviceNotFoundError>;
  }
>()('@porcelain/server/SetDeviceTrustUseCase') {
  static readonly layer = Layer.effect(
    SetDeviceTrustUseCase,
    Effect.gen(function* () {
      const setDeviceTrustCapability = yield* SetDeviceTrustService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('SetDeviceTrustUseCase.execute')(function* (
          input: SetDeviceTrustRequest,
        ): Effect.fn.Return<SetDeviceTrustResponse, DeviceNotFoundError> {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* setDeviceTrustCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}

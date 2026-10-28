import { Context, Effect, Layer } from 'effect';
import { type DeviceNotFoundError } from '@porcelain/access/errors';
import { SetWaysInPermissionService } from '@porcelain/access/services';
import {
  type SetWaysInPermissionRequest,
  type SetWaysInPermissionResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetWaysInPermissionUseCase extends Context.Service<
  SetWaysInPermissionUseCase,
  {
    readonly execute: (
      input: SetWaysInPermissionRequest,
    ) => Effect.Effect<SetWaysInPermissionResponse, DeviceNotFoundError>;
  }
>()('@porcelain/server/SetWaysInPermissionUseCase') {
  static readonly layer = Layer.effect(
    SetWaysInPermissionUseCase,
    Effect.gen(function* () {
      const setWaysInPermissionCapability = yield* SetWaysInPermissionService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('SetWaysInPermissionUseCase.execute')(function* (
          input: SetWaysInPermissionRequest,
        ): Effect.fn.Return<SetWaysInPermissionResponse, DeviceNotFoundError> {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* setWaysInPermissionCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}

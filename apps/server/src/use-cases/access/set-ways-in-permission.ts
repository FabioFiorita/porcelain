import { Context, Effect, Layer } from 'effect';
import {
  type SharingManagementRequiredError,
  type DeviceNotFoundError,
} from '@porcelain/access/errors';
import {
  AuthorizeSharingService,
  SetWaysInPermissionService,
} from '@porcelain/access/services';
import {
  type SetWaysInPermissionInput,
  type SetWaysInPermissionResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetWaysInPermissionUseCase extends Context.Service<
  SetWaysInPermissionUseCase,
  {
    readonly execute: (
      input: SetWaysInPermissionInput,
    ) => Effect.Effect<
      SetWaysInPermissionResponse,
      DeviceNotFoundError | SharingManagementRequiredError
    >;
  }
>()('@porcelain/server/SetWaysInPermissionUseCase') {
  static readonly layer = Layer.effect(
    SetWaysInPermissionUseCase,
    Effect.gen(function* () {
      const authorizeSharing = yield* AuthorizeSharingService;
      const setWaysInPermissionCapability = yield* SetWaysInPermissionService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('SetWaysInPermissionUseCase.execute')(function* (
          input: SetWaysInPermissionInput,
        ): Effect.fn.Return<
          SetWaysInPermissionResponse,
          DeviceNotFoundError | SharingManagementRequiredError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                yield* authorizeSharing.execute(input);
                return yield* setWaysInPermissionCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}

import { Context, Effect, Layer } from 'effect';
import {
  type SharingManagementRequiredError,
  type DeviceNotFoundError,
} from '@porcelain/access/errors';
import {
  AuthorizeSharingService,
  SetManagementPermissionService,
} from '@porcelain/access/services';
import {
  type SetManagementPermissionInput,
  type SetManagementPermissionResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetManagementPermissionUseCase extends Context.Service<
  SetManagementPermissionUseCase,
  {
    readonly execute: (
      input: SetManagementPermissionInput,
    ) => Effect.Effect<
      SetManagementPermissionResponse,
      DeviceNotFoundError | SharingManagementRequiredError
    >;
  }
>()('@porcelain/server/SetManagementPermissionUseCase') {
  static readonly layer = Layer.effect(
    SetManagementPermissionUseCase,
    Effect.gen(function* () {
      const authorizeSharing = yield* AuthorizeSharingService;
      const setManagementPermissionCapability =
        yield* SetManagementPermissionService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('SetManagementPermissionUseCase.execute')(function* (
          input: SetManagementPermissionInput,
        ): Effect.fn.Return<
          SetManagementPermissionResponse,
          DeviceNotFoundError | SharingManagementRequiredError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                yield* authorizeSharing.execute(input);
                return yield* setManagementPermissionCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}

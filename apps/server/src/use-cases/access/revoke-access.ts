import { type SharingManagementRequiredError } from '@porcelain/access/errors';
import { Context, Effect, Layer } from 'effect';
import {
  AuthorizeSharingService,
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import {
  type RevokeAccessInput,
  type RevokeAccessResponse,
} from '@porcelain/contracts/access';
import { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RevokeAccessUseCase extends Context.Service<
  RevokeAccessUseCase,
  {
    readonly execute: (
      input: RevokeAccessInput,
    ) => Effect.Effect<RevokeAccessResponse, SharingManagementRequiredError>;
  }
>()('@porcelain/server/RevokeAccessUseCase') {
  static readonly layer = Layer.effect(
    RevokeAccessUseCase,
    Effect.gen(function* () {
      const authorizeSharing = yield* AuthorizeSharingService;
      const revokePairingGrantCapability = yield* RevokePairingGrantService;
      const revokeDeviceCapability = yield* RevokeDeviceService;
      const deviceConnectionsCapability = yield* DeviceConnectionStore;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('RevokeAccessUseCase.execute')(function* (
          input: RevokeAccessInput,
        ): Effect.fn.Return<
          RevokeAccessResponse,
          SharingManagementRequiredError
        > {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                yield* authorizeSharing.execute(input);
                if (
                  (yield* revokePairingGrantCapability.execute(input)).kind ===
                  'revoked'
                )
                  return { revoked: true, kind: 'grant' as const };
                if (
                  (yield* revokeDeviceCapability.execute(input)).kind ===
                  'revoked'
                ) {
                  deviceConnectionsCapability.remove({
                    deviceId: input.id,
                  });
                  return { revoked: true, kind: 'device' as const };
                }
                return { revoked: false };
              }),
          );
        }),
      };
    }),
  );
}

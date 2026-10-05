import { Context, Effect, Layer } from 'effect';
import {
  RevokeDeviceService,
  RevokePairingGrantService,
} from '@porcelain/access/services';
import {
  type RevokeAccessRequest,
  type RevokeAccessResponse,
} from '@porcelain/contracts/access';
import { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class RevokeAccessUseCase extends Context.Service<
  RevokeAccessUseCase,
  {
    readonly execute: (
      input: RevokeAccessRequest,
    ) => Effect.Effect<RevokeAccessResponse, never>;
  }
>()('@porcelain/server/RevokeAccessUseCase') {
  static readonly layer = Layer.effect(
    RevokeAccessUseCase,
    Effect.gen(function* () {
      const revokePairingGrantCapability = yield* RevokePairingGrantService;
      const revokeDeviceCapability = yield* RevokeDeviceService;
      const deviceConnectionsCapability = yield* DeviceConnectionStore;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('RevokeAccessUseCase.execute')(function* (
          input: RevokeAccessRequest,
        ): Effect.fn.Return<RevokeAccessResponse, never> {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                if (
                  (yield* revokePairingGrantCapability.execute(input)).kind ===
                  'revoked'
                )
                  return { revoked: true, kind: 'grant' as const };
                if (
                  (yield* revokeDeviceCapability.execute(input)).kind ===
                  'revoked'
                ) {
                  deviceConnectionsCapability.remove({ deviceId: input.id });
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

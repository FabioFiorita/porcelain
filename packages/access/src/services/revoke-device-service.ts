import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';
import type {
  RevokeDeviceInput,
  RevokeDeviceResult,
} from '../models/revoke-device.ts';
import { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class RevokeDeviceService extends Context.Service<
  RevokeDeviceService,
  {
    readonly execute: (
      input: RevokeDeviceInput,
    ) => Effect.Effect<RevokeDeviceResult, never>;
  }
>()('@porcelain/access/RevokeDeviceService') {
  static readonly layer = Layer.effect(
    RevokeDeviceService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;
      const deviceSightings = yield* DeviceSightingStore;
      const clock = yield* Clock;

      return {
        execute: Effect.fn('RevokeDeviceService.execute')(function* (
          input: RevokeDeviceInput,
        ): Effect.fn.Return<RevokeDeviceResult, never> {
          const device = yield* devices.find({ deviceId: input.id });
          if (!device || deviceRevoked(device)) return { kind: 'not-revoked' };
          yield* devices.markRevoked({ device, revokedAt: clock.now() });
          deviceSightings.remove({ deviceId: device.id });
          return { kind: 'revoked' };
        }),
      };
    }),
  );
}

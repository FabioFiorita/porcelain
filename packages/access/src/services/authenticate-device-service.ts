import { AuthenticateDeviceOptions } from '../ports/authenticate-device-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceResult,
} from '../models/authenticate-device.ts';
import { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { parseCredential, secretMatches } from '../rules/credential.ts';
import {
  deviceUsable,
  sightingDue,
  sighted,
} from '../rules/device-activity.ts';

export class AuthenticateDeviceService extends Context.Service<
  AuthenticateDeviceService,
  {
    readonly execute: (
      input: AuthenticateDeviceInput,
    ) => Effect.Effect<AuthenticateDeviceResult, never>;
  }
>()('@porcelain/access/AuthenticateDeviceService') {
  static readonly layer = Layer.effect(
    AuthenticateDeviceService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;
      const deviceSightings = yield* DeviceSightingStore;
      const clock = yield* Clock.Clock;
      const options = yield* AuthenticateDeviceOptions;

      return {
        execute: Effect.fn('AuthenticateDeviceService.execute')(function* (
          input: AuthenticateDeviceInput,
        ): Effect.fn.Return<AuthenticateDeviceResult, never> {
          const credential = parseCredential('pcd', input.credential);
          if (!credential) return { kind: 'refused' };
          const device =
            deviceSightings.find({ deviceId: credential.id }) ??
            (yield* devices.find({ deviceId: credential.id }));
          if (
            !device ||
            !secretMatches(device.secretHash, credential.secret) ||
            device.route !== input.route
          )
            return { kind: 'refused' };
          const now = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clock.currentTimeMillis),
          );
          if (!deviceUsable(device, now, options.unusedLifetimeMs))
            return { kind: 'refused' };
          if (sightingDue(device, now))
            deviceSightings.save({
              device: sighted(device, now, input.address),
            });
          return { kind: 'authenticated', deviceId: device.id };
        }),
      };
    }),
  );
}

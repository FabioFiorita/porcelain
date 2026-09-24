import type { Clock } from '@porcelain/kernel/ports';
import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceOptions,
  AuthenticateDeviceResult,
} from '../models/authenticate-device.ts';
import type { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import { parseCredential, secretMatches } from '../rules/credential.ts';
import {
  deviceUsable,
  idleMilliseconds,
  sighted,
} from '../rules/device-activity.ts';

export class AuthenticateDeviceService {
  private readonly devices: DeviceStore;
  private readonly deviceSightings: DeviceSightingStore;
  private readonly clock: Clock;
  private readonly options: AuthenticateDeviceOptions;

  constructor(
    devices: DeviceStore,
    deviceSightings: DeviceSightingStore,
    clock: Clock,
    options: AuthenticateDeviceOptions,
  ) {
    this.devices = devices;
    this.deviceSightings = deviceSightings;
    this.clock = clock;
    this.options = options;
  }

  execute(input: AuthenticateDeviceInput): AuthenticateDeviceResult {
    const credential = parseCredential('pcd', input.credential);
    if (!credential) return { kind: 'refused' };
    const device =
      this.deviceSightings.find({ deviceId: credential.id }) ??
      this.devices.find({ deviceId: credential.id });
    if (!device || !secretMatches(device.secretHash, credential.secret))
      return { kind: 'refused' };
    const now = this.clock.now();
    if (!deviceUsable(device, now, this.options.unusedLifetimeMs))
      return { kind: 'refused' };
    if (idleMilliseconds(device, now) > 0)
      this.deviceSightings.save({
        device: sighted(device, now, input.address),
      });
    return { kind: 'authenticated', deviceId: device.id };
  }
}

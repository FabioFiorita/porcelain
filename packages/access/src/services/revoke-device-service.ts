import type { Clock } from '@porcelain/kernel/ports';
import type {
  RevokeDeviceInput,
  RevokeDeviceResult,
} from '../models/revoke-device.ts';
import type { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class RevokeDeviceService {
  private readonly devices: DeviceStore;
  private readonly deviceSightings: DeviceSightingStore;
  private readonly clock: Clock;

  constructor(
    devices: DeviceStore,
    deviceSightings: DeviceSightingStore,
    clock: Clock,
  ) {
    this.devices = devices;
    this.deviceSightings = deviceSightings;
    this.clock = clock;
  }

  execute(input: RevokeDeviceInput): RevokeDeviceResult {
    const device = this.devices.find({ deviceId: input.id });
    if (!device || deviceRevoked(device)) return { kind: 'not-revoked' };
    this.devices.markRevoked({ device, revokedAt: this.clock.now() });
    this.deviceSightings.remove({ deviceId: device.id });
    return { kind: 'revoked' };
  }
}

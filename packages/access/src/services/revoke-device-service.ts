import type { Clock } from '@porcelain/kernel/ports';
import type {
  RevokeDeviceInput,
  RevokeDeviceResult,
} from '../models/revoke-device.ts';
import type { DeviceStore } from '../ports/device-store.ts';

export class RevokeDeviceService {
  private readonly devices: DeviceStore;
  private readonly clock: Clock;

  constructor(devices: DeviceStore, clock: Clock) {
    this.devices = devices;
    this.clock = clock;
  }

  execute(input: RevokeDeviceInput): RevokeDeviceResult {
    const device = this.devices.find({ deviceId: input.id });
    if (!device || device.revokedAt !== undefined)
      return { kind: 'not-revoked' };
    this.devices.markRevoked({ device, revokedAt: this.clock.now() });
    return { kind: 'revoked' };
  }
}

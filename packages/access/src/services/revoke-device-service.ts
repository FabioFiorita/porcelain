import type {
  RevokeAccessInput,
  RevokeAccessResult,
} from '../models/revoke-access.ts';
import type { Clock } from '../ports/clock.ts';
import type { DeviceStore } from '../ports/device-store.ts';

export class RevokeDeviceService {
  private readonly deviceStore: DeviceStore;
  private readonly clock: Clock;

  constructor(deviceStore: DeviceStore, clock: Clock) {
    this.deviceStore = deviceStore;
    this.clock = clock;
  }

  execute(input: RevokeAccessInput): RevokeAccessResult {
    const device = this.deviceStore.find(input.id);
    if (!device || device.revokedAt !== undefined) return { revoked: false };
    this.deviceStore.markRevoked(device.id, this.clock.now());
    return { revoked: true, kind: 'device' };
  }
}

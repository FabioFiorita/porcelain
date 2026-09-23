import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceResult,
} from '../models/authenticate-device.ts';
import type { Clock } from '../ports/clock.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import { parseCredential, secretMatches } from '../rules/credential.ts';
import { deviceUsable, idleMilliseconds } from '../rules/device-activity.ts';

export class AuthenticateDeviceService {
  private readonly deviceStore: DeviceStore;
  private readonly clock: Clock;

  constructor(deviceStore: DeviceStore, clock: Clock) {
    this.deviceStore = deviceStore;
    this.clock = clock;
  }

  execute(input: AuthenticateDeviceInput): AuthenticateDeviceResult {
    const credential = parseCredential('pcd', input.credential);
    if (!credential) return undefined;
    const device = this.deviceStore.find(credential.id);
    if (!device || !secretMatches(device.secretHash, credential.secret))
      return undefined;
    const now = this.clock.now();
    if (!deviceUsable(device, now)) return undefined;
    const idleMs = idleMilliseconds(device, now);
    if (idleMs > 0)
      this.deviceStore.recordSightings([
        {
          deviceId: device.id,
          seenAt: now,
          ...(input.address === undefined ? {} : { address: input.address }),
        },
      ]);
    return { deviceId: device.id, idleMs };
  }
}

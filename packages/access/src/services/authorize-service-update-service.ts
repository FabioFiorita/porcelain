import { Effect } from 'effect';
import type {
  AuthorizeServiceUpdateInput,
  ServiceUpdateAuthority,
} from '../models/authorize-service-update.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class AuthorizeServiceUpdateService {
  private readonly devices: DeviceStore;

  constructor(devices: DeviceStore) {
    this.devices = devices;
  }

  execute(
    input: AuthorizeServiceUpdateInput,
  ): Effect.Effect<ServiceUpdateAuthority, never> {
    return Effect.sync(() => {
      const { viewer } = input;
      if (viewer.kind === 'owner' || input.local) return { canUpdate: true };
      const device = this.devices.find({ deviceId: viewer.deviceId });
      return {
        canUpdate:
          device !== undefined &&
          !deviceRevoked(device) &&
          device.trusted === true,
      };
    });
  }
}

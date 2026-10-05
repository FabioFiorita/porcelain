import { Effect } from 'effect';
import { DeviceNotFoundError } from '../errors/device-not-found-error.ts';
import type {
  SetDeviceTrustInput,
  SetDeviceTrustResult,
} from '../models/set-device-trust.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class SetDeviceTrustService {
  private readonly devices: DeviceStore;

  constructor(devices: DeviceStore) {
    this.devices = devices;
  }

  execute(
    input: SetDeviceTrustInput,
  ): Effect.Effect<SetDeviceTrustResult, DeviceNotFoundError> {
    return Effect.gen({ self: this }, function* () {
      const device = this.devices.find({ deviceId: input.id });
      if (!device || deviceRevoked(device))
        return yield* Effect.fail(new DeviceNotFoundError());
      this.devices.recordTrust({ device, trusted: input.trusted });
      return { id: device.id, trusted: input.trusted };
    });
  }
}

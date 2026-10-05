import { Effect } from 'effect';
import type { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import type { DeviceStore } from '../ports/device-store.ts';

export class FlushDeviceActivityService {
  private readonly deviceSightings: DeviceSightingStore;
  private readonly devices: DeviceStore;

  constructor(deviceSightings: DeviceSightingStore, devices: DeviceStore) {
    this.deviceSightings = deviceSightings;
    this.devices = devices;
  }

  execute(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      for (const device of this.deviceSightings.take())
        this.devices.recordSighting({ device });
    });
  }
}

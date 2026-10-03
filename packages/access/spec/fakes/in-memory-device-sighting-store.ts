import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceSightingStore } from '../../src/ports/device-sighting-store.ts';

export class InMemoryDeviceSightingStore implements DeviceSightingStore {
  private readonly sightings = new Map<string, StoredDevice>();

  find(input: { deviceId: string }): StoredDevice | undefined {
    return this.sightings.get(input.deviceId);
  }

  save(input: { device: StoredDevice }): void {
    this.sightings.set(input.device.id, input.device);
  }

  take(): StoredDevice[] {
    const pending = [...this.sightings.values()];
    this.sightings.clear();
    return pending;
  }

  remove(input: { deviceId: string }): void {
    this.sightings.delete(input.deviceId);
  }
}

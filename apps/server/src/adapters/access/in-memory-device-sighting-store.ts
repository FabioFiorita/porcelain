import { Effect, Layer } from 'effect';
import type { StoredDevice } from '@porcelain/access/models';
import { DeviceSightingStore } from '@porcelain/access/ports';

export const inMemoryDeviceSightingStoreLayer = Layer.effect(
  DeviceSightingStore,
  Effect.sync(() => {
    const sightings = new Map<string, StoredDevice>();
    return {
      find(input: { deviceId: string }): StoredDevice | undefined {
        return sightings.get(input.deviceId);
      },
      save(input: { device: StoredDevice }): void {
        sightings.set(input.device.id, input.device);
      },
      take(): StoredDevice[] {
        const pending = [...sightings.values()];
        sightings.clear();
        return pending;
      },
      remove(input: { deviceId: string }): void {
        sightings.delete(input.deviceId);
      },
    };
  }),
);

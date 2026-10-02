import { describe, expect, it } from 'vitest';
import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceSightingStore } from '../../src/ports/device-sighting-store.ts';

function seen(id: string, lastSeenAt: string): StoredDevice {
  return {
    id,
    label: `Phone ${id}`,
    platform: 'iOS',
    secretHash: `hash-${id}`,
    createdAt: '2026-09-20T10:00:00.000Z',
    lastSeenAt,
    lastSeenAddress: '192.168.1.10',
    route: 'lan',
  };
}

const EARLIER = '2026-09-24T10:00:00.000Z';
const LATER = '2026-09-24T10:05:00.000Z';

export function deviceSightingStoreContract(
  subject: string,
  openStore: () => DeviceSightingStore,
): void {
  describe(subject, () => {
    it('finds nothing for a device that was never seen, even after another device was', () => {
      const store = openStore();
      expect(store.find({ deviceId: 'phone' })).toBeUndefined();
      store.save({ device: seen('tablet', EARLIER) });
      expect(store.find({ deviceId: 'phone' })).toBeUndefined();
      expect(store.find({ deviceId: 'tablet' })).toEqual(
        seen('tablet', EARLIER),
      );
    });

    it('finds the latest sighting saved for a device', () => {
      const store = openStore();
      store.save({ device: seen('phone', EARLIER) });
      store.save({ device: seen('phone', LATER) });
      expect(store.find({ deviceId: 'phone' })).toEqual(seen('phone', LATER));
    });

    it('hands every pending sighting over once, latest per device, and keeps none', () => {
      const store = openStore();
      store.save({ device: seen('phone', EARLIER) });
      store.save({ device: seen('tablet', EARLIER) });
      store.save({ device: seen('phone', LATER) });
      expect(
        store.take().toSorted((left, right) => left.id.localeCompare(right.id)),
      ).toEqual([seen('phone', LATER), seen('tablet', EARLIER)]);
      expect(store.take()).toEqual([]);
      expect(store.find({ deviceId: 'phone' })).toBeUndefined();
    });

    it('hands nothing over when no device was seen, and the sighting once one is', () => {
      const store = openStore();
      expect(store.take()).toEqual([]);
      store.save({ device: seen('phone', EARLIER) });
      expect(store.take()).toEqual([seen('phone', EARLIER)]);
    });

    it('forgets the pending sighting of a removed device and keeps the others', () => {
      const store = openStore();
      store.save({ device: seen('phone', EARLIER) });
      store.save({ device: seen('tablet', EARLIER) });
      store.remove({ deviceId: 'phone' });
      expect(store.find({ deviceId: 'phone' })).toBeUndefined();
      expect(store.take()).toEqual([seen('tablet', EARLIER)]);
    });
  });
}

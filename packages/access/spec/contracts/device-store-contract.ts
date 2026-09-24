import { afterEach, describe, expect, it } from 'vitest';
import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

export type DeviceStoreSubject = {
  store: DeviceStore;
  close: () => void;
};

function device(
  id: string,
  createdAt = '2026-09-20T10:00:00.000Z',
): StoredDevice {
  return {
    id,
    label: `Phone ${id}`,
    platform: 'iOS',
    secretHash: `hash-${id}`,
    createdAt,
    lastSeenAt: createdAt,
    lastSeenAddress: '192.168.1.10',
  };
}

const sighting = {
  lastSeenAt: '2026-09-24T10:00:00.000Z',
  lastSeenAddress: '192.168.1.20',
};
const revokedAt = '2026-09-24T11:00:00.000Z';

export function deviceStoreContract(
  subject: string,
  openSubject: (devices: readonly StoredDevice[]) => DeviceStoreSubject,
): void {
  describe(subject, () => {
    let opened: DeviceStoreSubject | undefined;

    function open(devices: readonly StoredDevice[]): DeviceStore {
      opened = openSubject(devices);
      return opened.store;
    }

    afterEach(() => {
      opened?.close();
    });

    it('finds a paired device by id with everything stored for it', () => {
      const store = open([device('phone'), device('tablet')]);
      expect(store.find({ deviceId: 'tablet' })).toEqual(device('tablet'));
    });

    it('finds a device paired without an address', () => {
      const { lastSeenAddress: _, ...withoutAddress } = device('phone');
      const store = open([withoutAddress]);
      expect(store.find({ deviceId: 'phone' })).toEqual(withoutAddress);
    });

    it('finds nothing for an unknown device id', () => {
      const store = open([device('phone')]);
      expect(store.find({ deviceId: 'unknown' })).toBeUndefined();
    });

    it('lists no devices before any is paired', () => {
      expect(open([]).list()).toEqual([]);
    });

    it('lists every device, the first paired first', () => {
      const store = open([
        device('late', '2026-09-22T10:00:00.000Z'),
        device('early', '2026-09-20T10:00:00.000Z'),
        device('middle', '2026-09-21T10:00:00.000Z'),
      ]);
      expect(store.list().map((entry) => entry.id)).toEqual([
        'early',
        'middle',
        'late',
      ]);
    });

    it('marks the asked device revoked and keeps the others', () => {
      const store = open([device('phone'), device('tablet')]);
      store.markRevoked({ device: device('phone'), revokedAt });
      expect(store.find({ deviceId: 'phone' })).toEqual({
        ...device('phone'),
        revokedAt,
      });
      expect(store.find({ deviceId: 'tablet' })).toEqual(device('tablet'));
    });

    it('keeps the latest sighting when a device is revoked through an older copy', () => {
      const store = open([device('phone')]);
      store.recordSighting({ device: { ...device('phone'), ...sighting } });
      store.markRevoked({ device: device('phone'), revokedAt });
      expect(store.find({ deviceId: 'phone' })).toEqual({
        ...device('phone'),
        ...sighting,
        revokedAt,
      });
    });

    it('records when and where a device was last seen', () => {
      const store = open([device('phone'), device('tablet')]);
      store.recordSighting({ device: { ...device('phone'), ...sighting } });
      expect(store.find({ deviceId: 'phone' })).toEqual({
        ...device('phone'),
        ...sighting,
      });
      expect(store.find({ deviceId: 'tablet' })).toEqual(device('tablet'));
    });

    it('forgets the address when a device is seen without one', () => {
      const store = open([device('phone')]);
      const { lastSeenAddress: _, ...withoutAddress } = device('phone');
      store.recordSighting({
        device: { ...withoutAddress, lastSeenAt: sighting.lastSeenAt },
      });
      expect(store.find({ deviceId: 'phone' })).toEqual({
        ...withoutAddress,
        lastSeenAt: sighting.lastSeenAt,
      });
    });

    it('keeps a device revoked when a sighting arrives through a copy taken before the revocation', () => {
      const store = open([device('phone')]);
      store.markRevoked({ device: device('phone'), revokedAt });
      store.recordSighting({ device: { ...device('phone'), ...sighting } });
      expect(store.find({ deviceId: 'phone' })).toEqual({
        ...device('phone'),
        ...sighting,
        revokedAt,
      });
    });

    it('stores nothing when an unknown device is revoked or seen', () => {
      const store = open([device('phone')]);
      store.markRevoked({ device: device('unknown'), revokedAt });
      store.recordSighting({ device: { ...device('stranger'), ...sighting } });
      expect(store.list()).toEqual([device('phone')]);
    });

    it('hands out copies, so changing a returned device leaves the stored one unchanged', () => {
      const store = open([device('phone')]);
      Object.assign(store.find({ deviceId: 'phone' }) ?? {}, {
        label: 'Changed after finding',
      });
      Object.assign(store.list().at(0) ?? {}, {
        label: 'Changed after listing',
      });
      expect(store.find({ deviceId: 'phone' })).toEqual(device('phone'));
    });
  });
}

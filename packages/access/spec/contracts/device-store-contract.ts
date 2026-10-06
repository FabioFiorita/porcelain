import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoredDevice } from '../../src/models/device.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';

export type DeviceStoreSubject = {
  store: DeviceStore;
  close: () => Promise<void> | void;
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
    route: 'lan',
  };
}

const sighting = {
  lastSeenAt: '2026-09-24T10:00:00.000Z',
  lastSeenAddress: '192.168.1.20',
};
const revokedAt = '2026-09-24T11:00:00.000Z';

export function deviceStoreContract(
  subject: string,
  openSubject: (
    devices: readonly StoredDevice[],
  ) => DeviceStoreSubject | Promise<DeviceStoreSubject>,
): void {
  describe(subject, () => {
    let opened: DeviceStoreSubject | undefined;

    async function open(
      devices: readonly StoredDevice[],
    ): Promise<DeviceStore> {
      opened = await openSubject(devices);
      return opened.store;
    }

    afterEach(async () => {
      await opened?.close();
    });

    it('finds a paired device by id with everything stored for it', async () => {
      const store = await open([device('phone'), device('tablet')]);
      expect(
        await Effect.runPromise(store.find({ deviceId: 'tablet' })),
      ).toEqual(device('tablet'));
    });

    it('keeps the route each device is bound to and whether it was inferred', async () => {
      const tablet: StoredDevice = {
        ...device('tablet'),
        route: 'tunnel',
        routeInferred: true,
      };
      const store = await open([device('phone'), tablet]);
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual(device('phone'));
      expect(
        await Effect.runPromise(store.find({ deviceId: 'tablet' })),
      ).toEqual(tablet);
    });

    it('finds a device paired without an address', async () => {
      const { lastSeenAddress: _, ...withoutAddress } = device('phone');
      const store = await open([withoutAddress]);
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual(withoutAddress);
    });

    it('finds nothing for an unknown device id', async () => {
      const store = await open([device('phone')]);
      expect(
        await Effect.runPromise(store.find({ deviceId: 'unknown' })),
      ).toBeUndefined();
    });

    it('lists no devices before any is paired', async () => {
      expect(await Effect.runPromise((await open([])).list())).toEqual([]);
    });

    it('lists every device, the first paired first', async () => {
      const store = await open([
        device('late', '2026-09-22T10:00:00.000Z'),
        device('early', '2026-09-20T10:00:00.000Z'),
        device('middle', '2026-09-21T10:00:00.000Z'),
      ]);
      expect(
        (await Effect.runPromise(store.list())).map((entry) => entry.id),
      ).toEqual(['early', 'middle', 'late']);
    });

    it('marks the asked device revoked and keeps the others', async () => {
      const store = await open([device('phone'), device('tablet')]);
      await Effect.runPromise(
        store.markRevoked({ device: device('phone'), revokedAt }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...device('phone'),
        revokedAt,
      });
      expect(
        await Effect.runPromise(store.find({ deviceId: 'tablet' })),
      ).toEqual(device('tablet'));
    });

    it('keeps the latest sighting when a device is revoked through an older copy', async () => {
      const store = await open([device('phone')]);
      await Effect.runPromise(
        store.recordSighting({ device: { ...device('phone'), ...sighting } }),
      );
      await Effect.runPromise(
        store.markRevoked({ device: device('phone'), revokedAt }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...device('phone'),
        ...sighting,
        revokedAt,
      });
    });

    it('records when and where a device was last seen', async () => {
      const store = await open([device('phone'), device('tablet')]);
      await Effect.runPromise(
        store.recordSighting({ device: { ...device('phone'), ...sighting } }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...device('phone'),
        ...sighting,
      });
      expect(
        await Effect.runPromise(store.find({ deviceId: 'tablet' })),
      ).toEqual(device('tablet'));
    });

    it('forgets the address when a device is seen without one', async () => {
      const store = await open([device('phone')]);
      const { lastSeenAddress: _, ...withoutAddress } = device('phone');
      await Effect.runPromise(
        store.recordSighting({
          device: { ...withoutAddress, lastSeenAt: sighting.lastSeenAt },
        }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...withoutAddress,
        lastSeenAt: sighting.lastSeenAt,
      });
    });

    it('keeps a device revoked when a sighting arrives through a copy taken before the revocation', async () => {
      const store = await open([device('phone')]);
      await Effect.runPromise(
        store.markRevoked({ device: device('phone'), revokedAt }),
      );
      await Effect.runPromise(
        store.recordSighting({ device: { ...device('phone'), ...sighting } }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...device('phone'),
        ...sighting,
        revokedAt,
      });
    });

    it('keeps whether the owner trusts each device, a device paired untrusted by default', async () => {
      const tablet: StoredDevice = { ...device('tablet'), trusted: true };
      const store = await open([device('phone'), tablet]);
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual(device('phone'));
      expect(
        await Effect.runPromise(store.find({ deviceId: 'tablet' })),
      ).toEqual(tablet);
    });

    it('trusts the asked device, even one found before, and keeps the others untrusted', async () => {
      const store = await open([device('phone'), device('tablet')]);
      await Effect.runPromise(store.find({ deviceId: 'phone' }));
      await Effect.runPromise(
        store.recordTrust({ device: device('phone'), trusted: true }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...device('phone'),
        trusted: true,
      });
      expect(
        await Effect.runPromise(store.find({ deviceId: 'tablet' })),
      ).toEqual(device('tablet'));
    });

    it('stops trusting a device the owner no longer trusts, even one found before', async () => {
      const store = await open([{ ...device('phone'), trusted: true }]);
      await Effect.runPromise(store.find({ deviceId: 'phone' }));
      await Effect.runPromise(
        store.recordTrust({ device: device('phone'), trusted: false }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual(device('phone'));
    });

    it('keeps the latest sighting and revocation when trust changes through an older copy, and trust through later sightings', async () => {
      const store = await open([device('phone')]);
      await Effect.runPromise(
        store.recordSighting({ device: { ...device('phone'), ...sighting } }),
      );
      await Effect.runPromise(
        store.markRevoked({ device: device('phone'), revokedAt }),
      );
      await Effect.runPromise(
        store.recordTrust({ device: device('phone'), trusted: true }),
      );
      await Effect.runPromise(
        store.recordSighting({ device: { ...device('phone'), ...sighting } }),
      );
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual({
        ...device('phone'),
        ...sighting,
        trusted: true,
        revokedAt,
      });
    });

    it('stores nothing when an unknown device is revoked, seen or trusted', async () => {
      const store = await open([device('phone')]);
      await Effect.runPromise(
        store.markRevoked({ device: device('unknown'), revokedAt }),
      );
      await Effect.runPromise(
        store.recordSighting({
          device: { ...device('stranger'), ...sighting },
        }),
      );
      await Effect.runPromise(
        store.recordTrust({ device: device('stranger'), trusted: true }),
      );
      expect(await Effect.runPromise(store.list())).toEqual([device('phone')]);
    });

    it('hands out copies, so changing a returned device leaves the stored one unchanged', async () => {
      const store = await open([device('phone')]);
      Object.assign(
        (await Effect.runPromise(store.find({ deviceId: 'phone' }))) ?? {},
        {
          label: 'Changed after finding',
        },
      );
      Object.assign((await Effect.runPromise(store.list())).at(0) ?? {}, {
        label: 'Changed after listing',
      });
      expect(
        await Effect.runPromise(store.find({ deviceId: 'phone' })),
      ).toEqual(device('phone'));
    });
  });
}

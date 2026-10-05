import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StoredDevice } from '../../src/models/device.ts';
import type { StoredPairingGrant } from '../../src/models/pairing-grant.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';
import type { PairingGrantStore } from '../../src/ports/pairing-grant-store.ts';

export type PairingGrantStoreSubject = {
  grants: PairingGrantStore;
  devices: DeviceStore;
  close: () => Promise<void> | void;
};

function grant(
  id: string,
  createdAt = '2026-09-24T10:00:00.000Z',
): StoredPairingGrant {
  return {
    id,
    label: `Grant ${id}`,
    addresses: ['http://192.168.1.10:4173'],
    createdAt,
    expiresAt: '2026-09-24T10:10:00.000Z',
    secretHash: `hash-${id}`,
  };
}

const device: StoredDevice = {
  id: 'phone',
  label: 'Phone',
  platform: 'iOS',
  secretHash: 'device-hash',
  createdAt: '2026-09-24T10:05:00.000Z',
  lastSeenAt: '2026-09-24T10:05:00.000Z',
  lastSeenAddress: '192.168.1.20',
  route: 'lan',
};
const redeemedAt = '2026-09-24T10:05:00.000Z';
const revokedAt = '2026-09-24T10:06:00.000Z';

export function pairingGrantStoreContract(
  subject: string,
  openSubject: () =>
    | PairingGrantStoreSubject
    | Promise<PairingGrantStoreSubject>,
): void {
  describe(subject, () => {
    let opened: PairingGrantStoreSubject;
    let grants: PairingGrantStore;

    beforeEach(async () => {
      opened = await openSubject();
      grants = opened.grants;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('finds each added grant by id with everything stored for it', async () => {
      await Effect.runPromise(
        grants.add({ grants: [grant('one'), grant('two')] }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'two' }))).toEqual(
        grant('two'),
      );
    });

    it('finds a grant offered on no address', async () => {
      await Effect.runPromise(
        grants.add({ grants: [{ ...grant('one'), addresses: [] }] }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual({
        ...grant('one'),
        addresses: [],
      });
    });

    it('finds nothing for an unknown grant id', async () => {
      await Effect.runPromise(grants.add({ grants: [grant('one')] }));
      expect(
        await Effect.runPromise(grants.find({ grantId: 'unknown' })),
      ).toBeUndefined();
    });

    it('lists nothing when no grants are added, and the grant once one is', async () => {
      await Effect.runPromise(grants.add({ grants: [] }));
      expect(await Effect.runPromise(grants.list())).toEqual([]);
      await Effect.runPromise(grants.add({ grants: [grant('one')] }));
      expect(await Effect.runPromise(grants.list())).toEqual([grant('one')]);
    });

    it('lists every grant, the first created first', async () => {
      await Effect.runPromise(
        grants.add({ grants: [grant('late', '2026-09-24T12:00:00.000Z')] }),
      );
      await Effect.runPromise(
        grants.add({
          grants: [
            grant('early', '2026-09-24T09:00:00.000Z'),
            grant('middle', '2026-09-24T11:00:00.000Z'),
          ],
        }),
      );
      expect(
        (await Effect.runPromise(grants.list())).map((entry) => entry.id),
      ).toEqual(['early', 'middle', 'late']);
    });

    it('marks the asked grant revoked and keeps the others', async () => {
      await Effect.runPromise(
        grants.add({ grants: [grant('one'), grant('two')] }),
      );
      await Effect.runPromise(
        grants.markRevoked({ grant: grant('one'), revokedAt }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual({
        ...grant('one'),
        revokedAt,
      });
      expect(await Effect.runPromise(grants.find({ grantId: 'two' }))).toEqual(
        grant('two'),
      );
    });

    it('marks the grant redeemed and pairs the device it was redeemed for', async () => {
      await Effect.runPromise(
        grants.add({ grants: [grant('one'), grant('two')] }),
      );
      await Effect.runPromise(
        grants.redeem({ grant: grant('one'), redeemedAt, device }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual({
        ...grant('one'),
        redeemedAt,
      });
      expect(await Effect.runPromise(grants.find({ grantId: 'two' }))).toEqual(
        grant('two'),
      );
      expect(
        await Effect.runPromise(opened.devices.find({ deviceId: device.id })),
      ).toEqual(device);
    });

    it('keeps a grant that pairs a trusted device and the trusted device it paired', async () => {
      const trusted: StoredPairingGrant = { ...grant('one'), trusted: true };
      const trustedDevice: StoredDevice = { ...device, trusted: true };
      await Effect.runPromise(grants.add({ grants: [trusted, grant('two')] }));
      await Effect.runPromise(
        grants.redeem({ grant: trusted, redeemedAt, device: trustedDevice }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual({
        ...trusted,
        redeemedAt,
      });
      expect(await Effect.runPromise(grants.find({ grantId: 'two' }))).toEqual(
        grant('two'),
      );
      expect(
        await Effect.runPromise(opened.devices.find({ deviceId: device.id })),
      ).toEqual(trustedDevice);
    });

    it('keeps a redemption when the grant is revoked through an older copy', async () => {
      await Effect.runPromise(grants.add({ grants: [grant('one')] }));
      await Effect.runPromise(
        grants.redeem({ grant: grant('one'), redeemedAt, device }),
      );
      await Effect.runPromise(
        grants.markRevoked({ grant: grant('one'), revokedAt }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual({
        ...grant('one'),
        redeemedAt,
        revokedAt,
      });
    });

    it('keeps a revocation when the grant is redeemed through an older copy', async () => {
      await Effect.runPromise(grants.add({ grants: [grant('one')] }));
      await Effect.runPromise(
        grants.markRevoked({ grant: grant('one'), revokedAt }),
      );
      await Effect.runPromise(
        grants.redeem({ grant: grant('one'), redeemedAt, device }),
      );
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual({
        ...grant('one'),
        redeemedAt,
        revokedAt,
      });
    });

    it('hands out copies, so changing a returned grant leaves the stored one unchanged', async () => {
      const added = grant('one');
      await Effect.runPromise(grants.add({ grants: [added] }));
      added.addresses.push('http://intruder.test');
      (
        await Effect.runPromise(grants.find({ grantId: 'one' }))
      )?.addresses.push('http://intruder.test');
      (await Effect.runPromise(grants.list()))
        .at(0)
        ?.addresses.push('http://intruder.test');
      expect(await Effect.runPromise(grants.find({ grantId: 'one' }))).toEqual(
        grant('one'),
      );
    });
  });
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StoredDevice } from '../../src/models/device.ts';
import type { StoredPairingGrant } from '../../src/models/pairing-grant.ts';
import type { DeviceStore } from '../../src/ports/device-store.ts';
import type { PairingGrantStore } from '../../src/ports/pairing-grant-store.ts';

export type PairingGrantStoreSubject = {
  grants: PairingGrantStore;
  devices: DeviceStore;
  close: () => void;
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
};
const redeemedAt = '2026-09-24T10:05:00.000Z';
const revokedAt = '2026-09-24T10:06:00.000Z';

export function pairingGrantStoreContract(
  subject: string,
  openSubject: () => PairingGrantStoreSubject,
): void {
  describe(subject, () => {
    let opened: PairingGrantStoreSubject;
    let grants: PairingGrantStore;

    beforeEach(() => {
      opened = openSubject();
      grants = opened.grants;
    });

    afterEach(() => {
      opened.close();
    });

    it('finds each added grant by id with everything stored for it', () => {
      grants.add({ grants: [grant('one'), grant('two')] });
      expect(grants.find({ grantId: 'two' })).toEqual(grant('two'));
    });

    it('finds a grant offered on no address', () => {
      grants.add({ grants: [{ ...grant('one'), addresses: [] }] });
      expect(grants.find({ grantId: 'one' })).toEqual({
        ...grant('one'),
        addresses: [],
      });
    });

    it('finds nothing for an unknown grant id', () => {
      grants.add({ grants: [grant('one')] });
      expect(grants.find({ grantId: 'unknown' })).toBeUndefined();
    });

    it('lists nothing when no grants are added', () => {
      grants.add({ grants: [] });
      expect(grants.list()).toEqual([]);
    });

    it('lists every grant, the first created first', () => {
      grants.add({ grants: [grant('late', '2026-09-24T12:00:00.000Z')] });
      grants.add({
        grants: [
          grant('early', '2026-09-24T09:00:00.000Z'),
          grant('middle', '2026-09-24T11:00:00.000Z'),
        ],
      });
      expect(grants.list().map((entry) => entry.id)).toEqual([
        'early',
        'middle',
        'late',
      ]);
    });

    it('marks the asked grant revoked and keeps the others', () => {
      grants.add({ grants: [grant('one'), grant('two')] });
      grants.markRevoked({ grant: grant('one'), revokedAt });
      expect(grants.find({ grantId: 'one' })).toEqual({
        ...grant('one'),
        revokedAt,
      });
      expect(grants.find({ grantId: 'two' })).toEqual(grant('two'));
    });

    it('marks the grant redeemed and pairs the device it was redeemed for', () => {
      grants.add({ grants: [grant('one'), grant('two')] });
      grants.redeem({ grant: grant('one'), redeemedAt, device });
      expect(grants.find({ grantId: 'one' })).toEqual({
        ...grant('one'),
        redeemedAt,
      });
      expect(grants.find({ grantId: 'two' })).toEqual(grant('two'));
      expect(opened.devices.find({ deviceId: device.id })).toEqual(device);
    });

    it('keeps a redemption when the grant is revoked through an older copy', () => {
      grants.add({ grants: [grant('one')] });
      grants.redeem({ grant: grant('one'), redeemedAt, device });
      grants.markRevoked({ grant: grant('one'), revokedAt });
      expect(grants.find({ grantId: 'one' })).toEqual({
        ...grant('one'),
        redeemedAt,
        revokedAt,
      });
    });

    it('keeps a revocation when the grant is redeemed through an older copy', () => {
      grants.add({ grants: [grant('one')] });
      grants.markRevoked({ grant: grant('one'), revokedAt });
      grants.redeem({ grant: grant('one'), redeemedAt, device });
      expect(grants.find({ grantId: 'one' })).toEqual({
        ...grant('one'),
        redeemedAt,
        revokedAt,
      });
    });

    it('hands out copies, so changing a returned grant leaves the stored one unchanged', () => {
      const added = grant('one');
      grants.add({ grants: [added] });
      added.addresses.push('http://intruder.test');
      grants.find({ grantId: 'one' })?.addresses.push('http://intruder.test');
      grants.list().at(0)?.addresses.push('http://intruder.test');
      expect(grants.find({ grantId: 'one' })).toEqual(grant('one'));
    });
  });
}

import { describe, expect, it } from 'vitest';
import { FixedClock } from '@porcelain/kernel/fakes';
import type {
  StoredDevice,
  StoredPairingGrant,
} from '@porcelain/access/models';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { ListAccessService } from './list-access-service.ts';

function grant(
  id: string,
  extra: Partial<StoredPairingGrant> = {},
): StoredPairingGrant {
  return {
    id,
    label: `Grant ${id}`,
    addresses: ['http://192.168.1.20:4173'],
    createdAt: `2026-09-23T10:00:0${id}.000Z`,
    expiresAt: '2026-09-23T10:15:00.000Z',
    secretHash: 'grant-hash',
    ...extra,
  };
}

function device(id: string, extra: Partial<StoredDevice> = {}): StoredDevice {
  return {
    id,
    label: `Device ${id}`,
    platform: 'iOS',
    createdAt: `2026-09-2${id}T10:00:00.000Z`,
    lastSeenAt: '2026-09-23T09:00:00.000Z',
    secretHash: 'device-hash',
    ...extra,
  };
}

function setup() {
  const devices = new InMemoryDeviceStore();
  const grants = new InMemoryPairingGrantStore(devices);
  const service = new ListAccessService(
    grants,
    devices,
    new FixedClock('2026-09-23T10:05:00.000Z'),
  );
  return { devices, grants, service };
}

describe('ListAccessService', () => {
  it('lists only grants that can still be redeemed, oldest first, without their secrets', () => {
    const { grants, service } = setup();
    grants.add({
      grants: [
        grant('5'),
        grant('2', { redeemedAt: '2026-09-23T10:01:00.000Z' }),
        grant('3', { revokedAt: '2026-09-23T10:01:00.000Z' }),
        grant('4', { expiresAt: '2026-09-23T10:05:00.000Z' }),
        grant('1'),
      ],
    });

    expect(service.execute().grants).toEqual([
      {
        id: '1',
        label: 'Grant 1',
        addresses: ['http://192.168.1.20:4173'],
        createdAt: '2026-09-23T10:00:01.000Z',
        expiresAt: '2026-09-23T10:15:00.000Z',
      },
      {
        id: '5',
        label: 'Grant 5',
        addresses: ['http://192.168.1.20:4173'],
        createdAt: '2026-09-23T10:00:05.000Z',
        expiresAt: '2026-09-23T10:15:00.000Z',
      },
    ]);
  });

  it('lists paired devices that are not revoked, oldest first, without their secrets', () => {
    const { devices, service } = setup();
    devices.add(device('2', { lastSeenAddress: '192.168.1.30' }));
    devices.add(device('1'));
    devices.add(device('3', { revokedAt: '2026-09-23T08:00:00.000Z' }));

    expect(service.execute().devices).toEqual([
      {
        id: '1',
        label: 'Device 1',
        platform: 'iOS',
        createdAt: '2026-09-21T10:00:00.000Z',
        lastSeenAt: '2026-09-23T09:00:00.000Z',
      },
      {
        id: '2',
        label: 'Device 2',
        platform: 'iOS',
        createdAt: '2026-09-22T10:00:00.000Z',
        lastSeenAt: '2026-09-23T09:00:00.000Z',
        lastSeenAddress: '192.168.1.30',
      },
    ]);
  });

  it('lists nothing when nothing was ever paired', () => {
    expect(setup().service.execute()).toEqual({ grants: [], devices: [] });
  });
});

import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdSource } from '@porcelain/kernel/fakes';
import {
  InvalidDeviceDetailsError,
  InvalidPairingError,
} from '@porcelain/access/errors';
import type { StoredPairingGrant } from '@porcelain/access/models';
import {
  credential,
  parseCredential,
  secretMatches,
} from '@porcelain/access/rules';
import { sha256Hex } from '@porcelain/kernel/rules';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { SequentialSecretSource } from '../../spec/fakes/sequential-secret-source.ts';
import { RedeemPairingService } from './redeem-pairing-service.ts';

const issuedAt = '2026-09-23T10:00:00.000Z';
const grantId = 'aaaaaaaa-0000-4000-8000-000000000001';
const secret = 'g'.repeat(43);

function setup(grant: Partial<StoredPairingGrant> = {}) {
  const devices = new InMemoryDeviceStore();
  const grants = new InMemoryPairingGrantStore(devices);
  grants.add({
    grants: [
      {
        id: grantId,
        label: 'Phone',
        addresses: ['http://192.168.1.20:4173'],
        createdAt: issuedAt,
        expiresAt: '2026-09-23T10:15:00.000Z',
        secretHash: sha256Hex(secret),
        ...grant,
      },
    ],
  });
  const clock = new FixedClock('2026-09-23T10:05:00.000Z');
  const service = new RedeemPairingService(
    grants,
    clock,
    new SequentialIdSource(),
    new SequentialSecretSource(),
    { labelLength: 80, platformLength: 120 },
  );
  return {
    devices,
    grants,
    clock,
    service,
    code: credential('pcp', grantId, secret).token,
  };
}

describe('RedeemPairingService', () => {
  it('turns a code into a device named after its grant', () => {
    const { devices, service, code } = setup();
    const { device, credential: issued } = service.execute({
      code,
      platform: 'iOS',
    });
    expect(device).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      label: 'Phone',
      platform: 'iOS',
      createdAt: '2026-09-23T10:05:00.000Z',
      lastSeenAt: '2026-09-23T10:05:00.000Z',
    });
    const parts = parseCredential('pcd', issued);
    expect(parts?.id).toBe(device.id);
    const stored = devices.find({ deviceId: device.id });
    expect(secretMatches(stored?.secretHash ?? '', parts?.secret ?? '')).toBe(
      true,
    );
  });

  it('names the device with the label it submits, trimmed', () => {
    const { service, code } = setup();
    const { device } = service.execute({
      code,
      platform: ' Browser ',
      label: ' Work laptop ',
    });
    expect(device).toMatchObject({ label: 'Work laptop', platform: 'Browser' });
  });

  it('consumes the code, so a second redemption is refused', () => {
    const { devices, grants, service, code } = setup();
    service.execute({ code, platform: 'iOS' });
    expect(grants.find({ grantId })?.redeemedAt).toBe(
      '2026-09-23T10:05:00.000Z',
    );
    expect(() => service.execute({ code, platform: 'iOS' })).toThrow(
      InvalidPairingError,
    );
    expect(devices.list()).toHaveLength(1);
  });

  it.each([
    { name: 'a malformed code', attempt: 'pcp_unknown' },
    {
      name: 'an unknown grant',
      attempt: credential('pcp', 'bbbbbbbb-0000-4000-8000-000000000002', secret)
        .token,
    },
    {
      name: 'a wrong secret',
      attempt: credential('pcp', grantId, 'w'.repeat(43)).token,
    },
    {
      name: 'a device credential',
      attempt: credential('pcd', grantId, secret).token,
    },
  ])('refuses $name as an invalid pairing', ({ attempt }) => {
    const { service } = setup();
    expect(() => service.execute({ code: attempt, platform: 'iOS' })).toThrow(
      InvalidPairingError,
    );
  });

  it('accepts a code until the moment it expires', () => {
    const early = setup();
    early.clock.set('2026-09-23T10:14:59.999Z');
    expect(
      early.service.execute({ code: early.code, platform: 'iOS' }).device.label,
    ).toBe('Phone');
    const late = setup();
    late.clock.set('2026-09-23T10:15:00.000Z');
    expect(() =>
      late.service.execute({ code: late.code, platform: 'iOS' }),
    ).toThrow(InvalidPairingError);
  });

  it('refuses a code issued later than the current time', () => {
    const { clock, service, code } = setup();
    clock.set('2026-09-23T09:59:59.999Z');
    expect(() => service.execute({ code, platform: 'iOS' })).toThrow(
      InvalidPairingError,
    );
  });

  it('refuses a revoked grant', () => {
    const { service, code } = setup({ revokedAt: '2026-09-23T10:01:00.000Z' });
    expect(() => service.execute({ code, platform: 'iOS' })).toThrow(
      InvalidPairingError,
    );
  });

  it('refuses invalid device details without consuming the code', () => {
    const { devices, grants, service, code } = setup();
    expect(() => service.execute({ code, platform: 'iOS\u0007' })).toThrow(
      InvalidDeviceDetailsError,
    );
    expect(() =>
      service.execute({ code, platform: 'iOS', label: '  ' }),
    ).toThrow(InvalidDeviceDetailsError);
    expect(grants.find({ grantId })?.redeemedAt).toBeUndefined();
    expect(devices.list()).toEqual([]);
  });
});

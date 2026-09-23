import { describe, expect, it } from 'vitest';
import {
  InvalidDeviceDetailsError,
  InvalidPairingError,
} from '@porcelain/access/errors';
import {
  hashSecret,
  mintCredential,
  parseCredential,
  secretMatches,
} from '@porcelain/access/rules';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { SequentialIds } from '../../spec/fakes/sequential-ids.ts';
import { RedeemPairingService } from './redeem-pairing-service.ts';

const issuedAt = '2026-09-23T10:00:00.000Z';
const grantId = 'aaaaaaaa-0000-4000-8000-000000000001';

function setup(grant: { redeemedAt?: string; revokedAt?: string } = {}) {
  const grants = new InMemoryPairingGrantStore();
  const code = mintCredential('pcp', grantId);
  grants.add([
    {
      id: grantId,
      label: 'Phone',
      addresses: ['http://192.168.1.20:4173'],
      createdAt: issuedAt,
      expiresAt: '2026-09-23T10:15:00.000Z',
      secretHash: hashSecret(code.secret),
      ...grant,
    },
  ]);
  const clock = new FixedClock('2026-09-23T10:05:00.000Z');
  const service = new RedeemPairingService(grants, clock, new SequentialIds());
  return { grants, clock, service, code: code.token };
}

describe('RedeemPairingService', () => {
  it('turns a code into a device named after its grant', () => {
    const { grants, service, code } = setup();
    const { device, credential } = service.execute({ code, platform: 'iOS' });
    expect(device).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      label: 'Phone',
      platform: 'iOS',
      createdAt: '2026-09-23T10:05:00.000Z',
      lastSeenAt: '2026-09-23T10:05:00.000Z',
    });
    expect(parseCredential('pcd', credential)?.id).toBe(device.id);
    const stored = grants.deviceStore.find(device.id);
    expect(
      secretMatches(
        stored?.secretHash ?? '',
        parseCredential('pcd', credential)?.secret ?? '',
      ),
    ).toBe(true);
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
    const { grants, service, code } = setup();
    service.execute({ code, platform: 'iOS' });
    expect(grants.find(grantId)?.redeemedAt).toBe('2026-09-23T10:05:00.000Z');
    expect(() => service.execute({ code, platform: 'iOS' })).toThrow(
      InvalidPairingError,
    );
    expect(grants.deviceStore.list()).toHaveLength(1);
  });

  it('refuses a malformed code, an unknown grant and a wrong secret alike', () => {
    const { service, code } = setup();
    const unknown = mintCredential(
      'pcp',
      'bbbbbbbb-0000-4000-8000-000000000002',
    );
    const wrongSecret = mintCredential('pcp', grantId);
    for (const attempt of ['pcp_unknown', unknown.token, wrongSecret.token])
      expect(() => service.execute({ code: attempt, platform: 'iOS' })).toThrow(
        InvalidPairingError,
      );
    expect(() =>
      service.execute({ code: code.replace('pcp_', 'pcd_'), platform: 'iOS' }),
    ).toThrow(InvalidPairingError);
  });

  it('accepts a code until the moment it expires', () => {
    const early = setup();
    early.clock.at = '2026-09-23T10:14:59.999Z';
    expect(
      early.service.execute({ code: early.code, platform: 'iOS' }).device.label,
    ).toBe('Phone');
    const late = setup();
    late.clock.at = '2026-09-23T10:15:00.000Z';
    expect(() =>
      late.service.execute({ code: late.code, platform: 'iOS' }),
    ).toThrow(InvalidPairingError);
  });

  it('refuses a code issued later than the current time', () => {
    const { clock, service, code } = setup();
    clock.at = '2026-09-23T09:59:59.999Z';
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
    const { grants, service, code } = setup();
    expect(() => service.execute({ code, platform: 'iOS\u0007' })).toThrow(
      InvalidDeviceDetailsError,
    );
    expect(() =>
      service.execute({ code, platform: 'iOS', label: '  ' }),
    ).toThrow(InvalidDeviceDetailsError);
    expect(grants.find(grantId)?.redeemedAt).toBeUndefined();
    expect(grants.deviceStore.list()).toEqual([]);
  });
});

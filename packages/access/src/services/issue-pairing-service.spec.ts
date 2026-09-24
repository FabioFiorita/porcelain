import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdSource } from '@porcelain/kernel/fakes';
import {
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
} from '@porcelain/access/errors';
import { parseCredential, secretMatches } from '@porcelain/access/rules';
import { FixedPairingReachReader } from '../../spec/fakes/fixed-pairing-reach-reader.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { SequentialSecretSource } from '../../spec/fakes/sequential-secret-source.ts';
import { IssuePairingService } from './issue-pairing-service.ts';

const address = 'http://192.168.1.20:4173';
const environmentId = 'e0000000-0000-4000-8000-000000000001';

function setup() {
  const grants = new InMemoryPairingGrantStore();
  const service = new IssuePairingService(
    grants,
    new FixedPairingReachReader({
      port: 4173,
      policy: {
        allowedHosts: ['laptop.local'],
        localAddresses: ['192.168.1.20'],
      },
    }),
    new FixedClock('2026-09-23T10:00:00.000Z'),
    new SequentialIdSource(),
    new SequentialSecretSource(),
    { lifetimeMs: 15 * 60 * 1000 },
  );
  return { grants, service };
}

function issueOne(
  service: IssuePairingService,
  addresses: readonly string[] = [address],
) {
  const [issued] = service.execute({
    labels: ['Phone'],
    addresses,
    environmentId,
  }).grants;
  if (!issued) throw new Error('No grant was issued');
  return issued;
}

describe('IssuePairingService', () => {
  it('issues one grant per label, each with its own one-time code', () => {
    const { service } = setup();
    const { grants } = service.execute({
      labels: ['Phone', 'Tablet'],
      addresses: [address],
      environmentId,
    });
    expect(grants.map(({ grant }) => grant.label)).toEqual(['Phone', 'Tablet']);
    expect(grants.map(({ code }) => parseCredential('pcp', code)?.id)).toEqual(
      grants.map(({ grant }) => grant.id),
    );
    expect(new Set(grants.map(({ code }) => code)).size).toBe(2);
  });

  it('keeps only a hash of the code, which the code matches', () => {
    const { grants, service } = setup();
    const issued = issueOne(service);
    const secret = parseCredential('pcp', issued.code)?.secret ?? '';
    const stored = grants.find({ grantId: issued.grant.id });
    expect(stored?.secretHash).not.toContain(secret);
    expect(secretMatches(stored?.secretHash ?? '', secret)).toBe(true);
  });

  it('expires the grant one pairing lifetime after it was issued', () => {
    const { service } = setup();
    const issued = issueOne(service);
    expect(issued.grant.createdAt).toBe('2026-09-23T10:00:00.000Z');
    expect(issued.grant.expiresAt).toBe('2026-09-23T10:15:00.000Z');
  });

  it('records every address the link may be opened at, in order', () => {
    const { service } = setup();
    const addresses = ['http://laptop.local:4173', address];
    expect(issueOne(service, addresses).grant.addresses).toEqual(addresses);
  });

  it('links to the pair page at the first address with the code and environment in the fragment', () => {
    const { service } = setup();
    const issued = issueOne(service);
    const link = new URL(issued.link);
    expect(`${link.origin}${link.pathname}`).toBe(`${address}/pair`);
    const fragment = new URLSearchParams(link.hash.slice(1));
    expect(fragment.get('c')).toBe(issued.code);
    expect(fragment.get('e')).toBe(environmentId);
    expect(fragment.has('a')).toBe(false);
  });

  it('lists every address in the link when the grant has more than one', () => {
    const { service } = setup();
    const addresses = ['http://laptop.local:4173', address];
    const link = new URL(issueOne(service, addresses).link);
    expect(link.origin).toBe('http://laptop.local:4173');
    expect(new URLSearchParams(link.hash.slice(1)).get('a')).toBe(
      addresses.join(','),
    );
  });

  it('refuses an address the server does not answer at and issues nothing', () => {
    const { grants, service } = setup();
    expect(() =>
      service.execute({
        labels: ['Phone'],
        addresses: [address, 'http://192.168.1.99:4173'],
        environmentId,
      }),
    ).toThrow(InvalidPairingAddressError);
    expect(grants.list()).toEqual([]);
  });

  it('refuses the whole request when any label is invalid', () => {
    const { grants, service } = setup();
    expect(() =>
      service.execute({
        labels: ['Phone', ' \t '],
        addresses: [address],
        environmentId,
      }),
    ).toThrow(InvalidDeviceDetailsError);
    expect(grants.list()).toEqual([]);
  });
});

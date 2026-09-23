import { describe, expect, it } from 'vitest';
import {
  InvalidDeviceDetailsError,
  InvalidPairingAddressError,
} from '@porcelain/access/errors';
import { parseCredential, secretMatches } from '@porcelain/access/rules';
import { FixedClock } from '../../spec/fakes/fixed-clock.ts';
import { FixedPairingReachReader } from '../../spec/fakes/fixed-pairing-reach-reader.ts';
import { InMemoryPairingGrantStore } from '../../spec/fakes/in-memory-pairing-grant-store.ts';
import { SequentialIds } from '../../spec/fakes/sequential-ids.ts';
import { IssuePairingService } from './issue-pairing-service.ts';

const address = 'http://192.168.1.20:4173';

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
    new SequentialIds(),
  );
  return { grants, service };
}

describe('IssuePairingService', () => {
  it('issues one grant per label, each with its own one-time code', () => {
    const { service } = setup();
    const { grants } = service.execute({
      labels: ['Phone', 'Tablet'],
      addresses: [address],
    });
    expect(grants.map(({ grant }) => grant.label)).toEqual(['Phone', 'Tablet']);
    for (const { grant, code } of grants)
      expect(parseCredential('pcp', code)?.id).toBe(grant.id);
    expect(new Set(grants.map(({ code }) => code)).size).toBe(2);
  });

  it('keeps only a hash of the code, which the code matches', () => {
    const { grants, service } = setup();
    const [issued] = service.execute({
      labels: ['Phone'],
      addresses: [address],
    }).grants;
    const secret = parseCredential('pcp', issued?.code ?? '')?.secret ?? '';
    const stored = grants.find(issued?.grant.id ?? '');
    expect(stored?.secretHash).not.toContain(secret);
    expect(secretMatches(stored?.secretHash ?? '', secret)).toBe(true);
  });

  it('expires the grant fifteen minutes after it was issued', () => {
    const { service } = setup();
    const [issued] = service.execute({
      labels: ['Phone'],
      addresses: [address],
    }).grants;
    expect(issued?.grant.createdAt).toBe('2026-09-23T10:00:00.000Z');
    expect(issued?.grant.expiresAt).toBe('2026-09-23T10:15:00.000Z');
  });

  it('records every address the link may be opened at, in order', () => {
    const { service } = setup();
    const addresses = ['http://laptop.local:4173', address];
    const [issued] = service.execute({ labels: ['Phone'], addresses }).grants;
    expect(issued?.grant.addresses).toEqual(addresses);
  });

  it('refuses an address the server does not answer at and issues nothing', () => {
    const { grants, service } = setup();
    expect(() =>
      service.execute({
        labels: ['Phone'],
        addresses: [address, 'http://192.168.1.99:4173'],
      }),
    ).toThrow(InvalidPairingAddressError);
    expect(grants.list()).toEqual([]);
  });

  it('refuses the whole request when any label is invalid', () => {
    const { grants, service } = setup();
    expect(() =>
      service.execute({ labels: ['Phone', ' \t '], addresses: [address] }),
    ).toThrow(InvalidDeviceDetailsError);
    expect(grants.list()).toEqual([]);
  });
});

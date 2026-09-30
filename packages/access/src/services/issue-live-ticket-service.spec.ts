import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import { DeviceViewerRequiredError } from '@porcelain/access/errors';
import { parseCredential, secretMatches } from '@porcelain/access/rules';
import { InMemoryLiveTicketStore } from '../../spec/fakes/in-memory-live-ticket-store.ts';
import { IssueLiveTicketService } from './issue-live-ticket-service.ts';

const deviceId = '00000000-0000-4000-8000-00000000000d';
const viewer = { kind: 'device' as const, deviceId };
const now = '2026-09-30T10:00:00.000Z';
const lifetimeMs = 30_000;

function setup(maxOutstanding = 8) {
  const tickets = new InMemoryLiveTicketStore();
  const clock = new FixedClock(now);
  const service = new IssueLiveTicketService(
    tickets,
    clock,
    new SequentialIdSource(),
    new SequentialSecretSource(),
    { lifetimeMs, maxOutstanding },
  );
  return { tickets, clock, service };
}

describe('IssueLiveTicketService', () => {
  it('issues a live ticket for the device and route that expires after its lifetime', () => {
    const { tickets, service } = setup();
    const issued = service.execute({ viewer, route: 'tailnet' });
    const parts = parseCredential('pct', issued.ticket);
    expect(issued.expiresAt).toBe('2026-09-30T10:00:30.000Z');
    expect(parts).toBeDefined();
    expect(
      tickets.read().tickets.map(({ secretHash: _hash, ...ticket }) => ticket),
    ).toEqual([
      {
        id: parts?.id,
        deviceId,
        route: 'tailnet',
        expiresAt: issued.expiresAt,
      },
    ]);
  });

  it('keeps only a hash of the ticket secret', () => {
    const { tickets, service } = setup();
    const issued = service.execute({ viewer, route: 'lan' });
    const [stored] = tickets.read().tickets;
    const secret = parseCredential('pct', issued.ticket)?.secret ?? '';
    expect(JSON.stringify(tickets.read())).not.toContain(secret);
    expect(secretMatches(stored?.secretHash ?? '', secret)).toBe(true);
  });

  it('issues a different ticket every time', () => {
    const { service } = setup();
    const first = service.execute({ viewer, route: 'lan' });
    const second = service.execute({ viewer, route: 'lan' });
    expect(second.ticket).not.toBe(first.ticket);
  });

  it('forgets tickets that expired when it issues another', () => {
    const { tickets, clock, service } = setup();
    service.execute({ viewer, route: 'lan' });
    clock.set('2026-09-30T10:00:30.000Z');
    const fresh = service.execute({ viewer, route: 'lan' });
    expect(tickets.read().tickets.map((ticket) => ticket.expiresAt)).toEqual([
      fresh.expiresAt,
    ]);
  });

  it('keeps at most the outstanding limit, forgetting the oldest ticket', () => {
    const { tickets, service } = setup(2);
    const issued = [1, 2, 3].map(() =>
      service.execute({ viewer, route: 'lan' }),
    );
    expect(tickets.read().tickets.map((ticket) => ticket.id)).toEqual(
      issued.slice(1).map((entry) => parseCredential('pct', entry.ticket)?.id),
    );
  });

  it('refuses the owner, who is not a paired device, and keeps no ticket', () => {
    const { tickets, service } = setup();
    expect(() =>
      service.execute({ viewer: { kind: 'owner' }, route: 'loopback' }),
    ).toThrow(DeviceViewerRequiredError);
    expect(tickets.read().tickets).toEqual([]);
  });
});

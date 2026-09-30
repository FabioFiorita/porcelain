import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import {
  DeviceViewerRequiredError,
  TooManyLiveTicketsError,
} from '@porcelain/access/errors';
import { parseCredential, secretMatches } from '@porcelain/access/rules';
import { InMemoryLiveTicketStore } from '../../spec/fakes/in-memory-live-ticket-store.ts';
import { IssueLiveTicketService } from './issue-live-ticket-service.ts';

const deviceId = '00000000-0000-4000-8000-00000000000d';
const viewer = { kind: 'device' as const, deviceId };
const now = '2026-09-30T10:00:00.000Z';
const lifetimeMs = 30_000;

function setup(maxOutstanding = 8, maxPerDevice = 4) {
  const tickets = new InMemoryLiveTicketStore();
  const clock = new FixedClock(now);
  const service = new IssueLiveTicketService(
    tickets,
    clock,
    new SequentialIdSource(),
    new SequentialSecretSource(),
    { lifetimeMs, maxOutstanding, maxPerDevice },
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

  it("keeps at most the per-device limit, forgetting only that device's oldest ticket", () => {
    const { tickets, service } = setup(8, 2);
    const other = {
      kind: 'device' as const,
      deviceId: '00000000-0000-4000-8000-00000000000e',
    };
    const kept = service.execute({ viewer: other, route: 'lan' });
    const issued = [1, 2, 3].map(() =>
      service.execute({ viewer, route: 'lan' }),
    );
    expect(tickets.read().tickets.map((ticket) => ticket.id)).toEqual(
      [kept, ...issued.slice(1)].map(
        (entry) => parseCredential('pct', entry.ticket)?.id,
      ),
    );
  });

  it("never forgets another device's ticket to make room, and refuses a new ticket while the outstanding limit is reached", () => {
    const { tickets, service } = setup(2, 2);
    const first = {
      kind: 'device' as const,
      deviceId: '00000000-0000-4000-8000-00000000000e',
    };
    const second = {
      kind: 'device' as const,
      deviceId: '00000000-0000-4000-8000-00000000000f',
    };
    service.execute({ viewer: first, route: 'lan' });
    service.execute({ viewer: second, route: 'lan' });
    const before = tickets.read();
    expect(() => service.execute({ viewer, route: 'lan' })).toThrow(
      TooManyLiveTicketsError,
    );
    expect(tickets.read()).toEqual(before);
  });

  it('lets a device at the outstanding limit replace its own oldest ticket', () => {
    const { tickets, service } = setup(2, 2);
    const first = service.execute({ viewer, route: 'lan' });
    service.execute({ viewer, route: 'lan' });
    const third = service.execute({ viewer, route: 'lan' });
    expect(tickets.read().tickets).toHaveLength(2);
    expect(tickets.read().tickets.map((ticket) => ticket.id)).not.toContain(
      parseCredential('pct', first.ticket)?.id,
    );
    expect(tickets.read().tickets.map((ticket) => ticket.id)).toContain(
      parseCredential('pct', third.ticket)?.id,
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

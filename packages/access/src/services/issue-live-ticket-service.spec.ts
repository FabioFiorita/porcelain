import { testClock } from '@porcelain/kernel/test-kit';
import {
  SequentialIdSource,
  SequentialSecretSource,
} from '@porcelain/kernel/fakes';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';
import {
  LiveTicketStore,
  IssueLiveTicketOptions,
} from '@porcelain/access/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
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

async function setup(maxOutstanding = 8, maxPerDevice = 4) {
  const tickets = new InMemoryLiveTicketStore();
  const clock = await testClock(now);
  const service = Effect.runSync(
    IssueLiveTicketService.pipe(
      Effect.provide(IssueLiveTicketService.layer),
      Effect.provideService(LiveTicketStore, tickets),
      Effect.provideService(Clock.Clock, clock),
      Effect.provideService(IdSource, new SequentialIdSource()),
      Effect.provideService(SecretSource, new SequentialSecretSource()),
      Effect.provideService(IssueLiveTicketOptions, {
        lifetimeMs,
        maxOutstanding,
        maxPerDevice,
      }),
    ),
  );
  return { tickets, clock, service };
}

describe('IssueLiveTicketService', () => {
  it('issues a live ticket for the device and route that expires after its lifetime', async () => {
    const { tickets, service } = await setup();
    const issued = Effect.runSync(
      service.execute({ viewer, route: 'tailnet' }),
    );
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

  it('keeps only a hash of the ticket secret', async () => {
    const { tickets, service } = await setup();
    const issued = Effect.runSync(service.execute({ viewer, route: 'lan' }));
    const [stored] = tickets.read().tickets;
    const secret = parseCredential('pct', issued.ticket)?.secret ?? '';
    expect(JSON.stringify(tickets.read())).not.toContain(secret);
    expect(secretMatches(stored?.secretHash ?? '', secret)).toBe(true);
  });

  it('issues a different ticket every time', async () => {
    const { service } = await setup();
    const first = Effect.runSync(service.execute({ viewer, route: 'lan' }));
    const second = Effect.runSync(service.execute({ viewer, route: 'lan' }));
    expect(first.ticket).toBe(
      'pct_00000000-0000-4000-8000-000000000001_' + 's'.repeat(42) + '1',
    );
    expect(second.ticket).toBe(
      'pct_00000000-0000-4000-8000-000000000002_' + 's'.repeat(42) + '2',
    );
  });

  it('forgets tickets that expired when it issues another', async () => {
    const { tickets, clock, service } = await setup();
    Effect.runSync(service.execute({ viewer, route: 'lan' }));
    await Effect.runPromise(
      clock.setTime(Date.parse('2026-09-30T10:00:30.000Z')),
    );
    const fresh = Effect.runSync(service.execute({ viewer, route: 'lan' }));
    expect(tickets.read().tickets.map((ticket) => ticket.expiresAt)).toEqual([
      fresh.expiresAt,
    ]);
  });

  it("keeps at most the per-device limit, forgetting only that device's oldest ticket", async () => {
    const { tickets, service } = await setup(8, 2);
    const other = {
      kind: 'device' as const,
      deviceId: '00000000-0000-4000-8000-00000000000e',
    };
    const kept = Effect.runSync(
      service.execute({ viewer: other, route: 'lan' }),
    );
    const issued = [1, 2, 3].map(() =>
      Effect.runSync(service.execute({ viewer, route: 'lan' })),
    );
    expect(tickets.read().tickets.map((ticket) => ticket.id)).toEqual(
      [kept, ...issued.slice(1)].map(
        (entry) => parseCredential('pct', entry.ticket)?.id,
      ),
    );
  });

  it("never forgets another device's ticket to make room, and refuses a new ticket while the outstanding limit is reached", async () => {
    const { tickets, service } = await setup(2, 2);
    const first = {
      kind: 'device' as const,
      deviceId: '00000000-0000-4000-8000-00000000000e',
    };
    const second = {
      kind: 'device' as const,
      deviceId: '00000000-0000-4000-8000-00000000000f',
    };
    Effect.runSync(service.execute({ viewer: first, route: 'lan' }));
    Effect.runSync(service.execute({ viewer: second, route: 'lan' }));
    const before = tickets.read();
    expect(() =>
      Effect.runSync(service.execute({ viewer, route: 'lan' })),
    ).toThrow(TooManyLiveTicketsError);
    expect(tickets.read()).toEqual(before);
  });

  it('lets a device at the outstanding limit replace its own oldest ticket', async () => {
    const { tickets, service } = await setup(2, 2);
    const first = Effect.runSync(service.execute({ viewer, route: 'lan' }));
    Effect.runSync(service.execute({ viewer, route: 'lan' }));
    const third = Effect.runSync(service.execute({ viewer, route: 'lan' }));
    expect(tickets.read().tickets).toHaveLength(2);
    expect(tickets.read().tickets.map((ticket) => ticket.id)).not.toContain(
      parseCredential('pct', first.ticket)?.id,
    );
    expect(tickets.read().tickets.map((ticket) => ticket.id)).toContain(
      parseCredential('pct', third.ticket)?.id,
    );
  });

  it('refuses the owner, who is not a paired device, and keeps no ticket', async () => {
    const { tickets, service } = await setup();
    expect(() =>
      Effect.runSync(
        service.execute({ viewer: { kind: 'owner' }, route: 'loopback' }),
      ),
    ).toThrow(DeviceViewerRequiredError);
    expect(tickets.read().tickets).toEqual([]);
  });
});

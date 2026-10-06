import { testClock } from '@porcelain/kernel/test-kit';
import {
  LiveTicketStore,
  DeviceStore,
  DeviceSightingStore,
  RedeemLiveTicketOptions,
} from '@porcelain/access/ports';
import { Effect, Clock } from 'effect';
import { describe, expect, it } from 'vitest';
import type { StoredDevice } from '@porcelain/access/models';
import { credential } from '@porcelain/access/rules';
import { sha256Hex } from '@porcelain/kernel/rules';
import { InMemoryDeviceSightingStore } from '../../spec/fakes/in-memory-device-sighting-store.ts';
import { InMemoryDeviceStore } from '../../spec/fakes/in-memory-device-store.ts';
import { InMemoryLiveTicketStore } from '../../spec/fakes/in-memory-live-ticket-store.ts';
import { RedeemLiveTicketService } from './redeem-live-ticket-service.ts';

const deviceId = '00000000-0000-4000-8000-00000000000d';
const ticketId = '00000000-0000-4000-8000-0000000000a1';
const secret = 't'.repeat(43);
const issuedAt = '2026-09-30T10:00:00.000Z';
const expiresAt = '2026-09-30T10:00:30.000Z';
const day = 24 * 60 * 60 * 1000;
const ticket = credential('pct', ticketId, secret).token;

async function setup(device: Partial<StoredDevice> = {}) {
  const devices = new InMemoryDeviceStore();
  devices.add({
    id: deviceId,
    label: 'Desktop app',
    platform: 'macOS',
    createdAt: '2026-09-01T10:00:00.000Z',
    lastSeenAt: issuedAt,
    route: 'tailnet',
    secretHash: sha256Hex('d'.repeat(43)),
    ...device,
  });
  const tickets = new InMemoryLiveTicketStore();
  tickets.save({
    tickets: [
      {
        id: ticketId,
        secretHash: sha256Hex(secret),
        deviceId,
        route: 'tailnet',
        expiresAt,
      },
    ],
  });
  const clock = await testClock('2026-09-30T10:00:05.000Z');
  const service = Effect.runSync(
    RedeemLiveTicketService.pipe(
      Effect.provide(RedeemLiveTicketService.layer),
      Effect.provideService(LiveTicketStore, tickets),
      Effect.provideService(DeviceStore, devices),
      Effect.provideService(
        DeviceSightingStore,
        new InMemoryDeviceSightingStore(),
      ),
      Effect.provideService(Clock.Clock, clock),
      Effect.provideService(RedeemLiveTicketOptions, {
        unusedLifetimeMs: 90 * day,
      }),
    ),
  );
  return { devices, tickets, clock, service };
}

const refused = { kind: 'refused' };

describe('RedeemLiveTicketService', () => {
  it('authenticates the device the ticket was issued to, over the same route', async () => {
    const { service } = await setup();
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tailnet' })),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });

  it('refuses a ticket used once already', async () => {
    const { tickets, service } = await setup();
    Effect.runSync(service.execute({ ticket, route: 'tailnet' }));
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tailnet' })),
    ).toEqual(refused);
    expect(tickets.read().tickets).toEqual([]);
  });

  it('accepts a ticket until the moment it expires and refuses it from then on', async () => {
    const early = await setup();
    await Effect.runPromise(
      early.clock.setTime(Date.parse('2026-09-30T10:00:29.999Z')),
    );
    expect(
      Effect.runSync(early.service.execute({ ticket, route: 'tailnet' })),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
    const late = await setup();
    await Effect.runPromise(late.clock.setTime(Date.parse(expiresAt)));
    expect(
      Effect.runSync(late.service.execute({ ticket, route: 'tailnet' })),
    ).toEqual(refused);
  });

  it('refuses a ticket over another route and does not let it be tried again', async () => {
    const { service } = await setup();
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tunnel' })),
    ).toEqual(refused);
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tailnet' })),
    ).toEqual(refused);
  });

  it('refuses a ticket whose secret does not match', async () => {
    const { service } = await setup();
    expect(
      Effect.runSync(
        service.execute({
          ticket: credential('pct', ticketId, 'x'.repeat(43)).token,
          route: 'tailnet',
        }),
      ),
    ).toEqual(refused);
  });

  it.each([
    ['an unknown ticket', credential('pct', deviceId, secret).token],
    ['a device credential', credential('pcd', ticketId, secret).token],
    ['a pairing code', credential('pcp', ticketId, secret).token],
    ['an empty value', ''],
    ['a malformed value', `pct_${ticketId}_short`],
  ])('refuses %s without spending the ticket', async (_, value) => {
    const { service } = await setup();
    expect(
      Effect.runSync(service.execute({ ticket: value, route: 'tailnet' })),
    ).toEqual(refused);
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tailnet' })),
    ).toEqual({
      kind: 'authenticated',
      deviceId,
    });
  });

  it('refuses the ticket of a device revoked since it was issued', async () => {
    const { devices, service } = await setup();
    const device = await Effect.runPromise(devices.find({ deviceId }));
    if (device)
      await Effect.runPromise(
        devices.markRevoked({ device, revokedAt: issuedAt }),
      );
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tailnet' })),
    ).toEqual(refused);
  });

  it('refuses the ticket of a device left unused past its lifetime', async () => {
    const { service } = await setup({ lastSeenAt: '2026-06-01T10:00:00.000Z' });
    expect(
      Effect.runSync(service.execute({ ticket, route: 'tailnet' })),
    ).toEqual(refused);
  });
});

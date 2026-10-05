import { Effect } from 'effect';
import type { Clock } from '@porcelain/kernel/ports';
import type {
  RedeemLiveTicketInput,
  RedeemLiveTicketOptions,
  RedeemLiveTicketResult,
} from '../models/redeem-live-ticket.ts';
import type { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import type { DeviceStore } from '../ports/device-store.ts';
import type { LiveTicketStore } from '../ports/live-ticket-store.ts';
import { parseCredential, secretMatches } from '../rules/credential.ts';
import { deviceUsable } from '../rules/device-activity.ts';
import { liveTicketTaken } from '../rules/live-tickets.ts';

export class RedeemLiveTicketService {
  private readonly liveTickets: LiveTicketStore;
  private readonly devices: DeviceStore;
  private readonly deviceSightings: DeviceSightingStore;
  private readonly clock: Clock;
  private readonly options: RedeemLiveTicketOptions;

  constructor(
    liveTickets: LiveTicketStore,
    devices: DeviceStore,
    deviceSightings: DeviceSightingStore,
    clock: Clock,
    options: RedeemLiveTicketOptions,
  ) {
    this.liveTickets = liveTickets;
    this.devices = devices;
    this.deviceSightings = deviceSightings;
    this.clock = clock;
    this.options = options;
  }

  execute(
    input: RedeemLiveTicketInput,
  ): Effect.Effect<RedeemLiveTicketResult, never> {
    return Effect.sync(() => {
      const parts = parseCredential('pct', input.ticket);
      if (!parts) return { kind: 'refused' };
      const now = this.clock.now();
      const { tickets, ticket } = liveTicketTaken(
        this.liveTickets.read(),
        parts.id,
        now,
      );
      this.liveTickets.save(tickets);
      if (
        !ticket ||
        !secretMatches(ticket.secretHash, parts.secret) ||
        ticket.route !== input.route
      )
        return { kind: 'refused' };
      const device =
        this.deviceSightings.find({ deviceId: ticket.deviceId }) ??
        this.devices.find({ deviceId: ticket.deviceId });
      if (
        !device ||
        device.route !== input.route ||
        !deviceUsable(device, now, this.options.unusedLifetimeMs)
      )
        return { kind: 'refused' };
      return { kind: 'authenticated', deviceId: device.id };
    });
  }
}

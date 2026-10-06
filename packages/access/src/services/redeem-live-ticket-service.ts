import { RedeemLiveTicketOptions } from '../ports/redeem-live-ticket-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import type {
  RedeemLiveTicketInput,
  RedeemLiveTicketResult,
} from '../models/redeem-live-ticket.ts';
import { DeviceSightingStore } from '../ports/device-sighting-store.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { LiveTicketStore } from '../ports/live-ticket-store.ts';
import { parseCredential, secretMatches } from '../rules/credential.ts';
import { deviceUsable } from '../rules/device-activity.ts';
import { liveTicketTaken } from '../rules/live-tickets.ts';

export class RedeemLiveTicketService extends Context.Service<
  RedeemLiveTicketService,
  {
    readonly execute: (
      input: RedeemLiveTicketInput,
    ) => Effect.Effect<RedeemLiveTicketResult, never>;
  }
>()('@porcelain/access/RedeemLiveTicketService') {
  static readonly layer = Layer.effect(
    RedeemLiveTicketService,
    Effect.gen(function* () {
      const liveTickets = yield* LiveTicketStore;
      const devices = yield* DeviceStore;
      const deviceSightings = yield* DeviceSightingStore;
      const clock = yield* Clock.Clock;
      const options = yield* RedeemLiveTicketOptions;

      return {
        execute: Effect.fn('RedeemLiveTicketService.execute')(function* (
          input: RedeemLiveTicketInput,
        ): Effect.fn.Return<RedeemLiveTicketResult, never> {
          const parts = parseCredential('pct', input.ticket);
          if (!parts) return { kind: 'refused' };
          const now = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clock.currentTimeMillis),
          );
          const { tickets, ticket } = liveTicketTaken(
            liveTickets.read(),
            parts.id,
            now,
          );
          liveTickets.save(tickets);
          if (
            !ticket ||
            !secretMatches(ticket.secretHash, parts.secret) ||
            ticket.route !== input.route
          )
            return { kind: 'refused' };
          const device =
            deviceSightings.find({ deviceId: ticket.deviceId }) ??
            (yield* devices.find({ deviceId: ticket.deviceId }));
          if (
            !device ||
            device.route !== input.route ||
            !deviceUsable(device, now, options.unusedLifetimeMs)
          )
            return { kind: 'refused' };
          return { kind: 'authenticated', deviceId: device.id };
        }),
      };
    }),
  );
}

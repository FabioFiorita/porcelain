import { IssueLiveTicketOptions } from '../ports/issue-live-ticket-options.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { IdSource, SecretSource } from '@porcelain/kernel/ports';
import { instantAfter, sha256Hex } from '@porcelain/kernel/rules';
import { DeviceViewerRequiredError } from '../errors/device-viewer-required-error.ts';
import { TooManyLiveTicketsError } from '../errors/too-many-live-tickets-error.ts';
import type {
  IssueLiveTicketInput,
  IssueLiveTicketResult,
} from '../models/issue-live-ticket.ts';
import { LiveTicketStore } from '../ports/live-ticket-store.ts';
import { credential } from '../rules/credential.ts';
import { liveTicketIssued } from '../rules/live-tickets.ts';

export class IssueLiveTicketService extends Context.Service<
  IssueLiveTicketService,
  {
    readonly execute: (
      input: IssueLiveTicketInput,
    ) => Effect.Effect<
      IssueLiveTicketResult,
      DeviceViewerRequiredError | TooManyLiveTicketsError
    >;
  }
>()('@porcelain/access/IssueLiveTicketService') {
  static readonly layer = Layer.effect(
    IssueLiveTicketService,
    Effect.gen(function* () {
      const liveTickets = yield* LiveTicketStore;
      const clock = yield* Clock.Clock;
      const idSource = yield* IdSource;
      const secretSource = yield* SecretSource;
      const options = yield* IssueLiveTicketOptions;

      return {
        execute: Effect.fn('IssueLiveTicketService.execute')(function* (
          input: IssueLiveTicketInput,
        ): Effect.fn.Return<
          IssueLiveTicketResult,
          DeviceViewerRequiredError | TooManyLiveTicketsError
        > {
          const { viewer } = input;
          if (viewer.kind !== 'device')
            return yield* Effect.fail(new DeviceViewerRequiredError());
          const now = DateTime.formatIso(
            DateTime.makeUnsafe(yield* clock.currentTimeMillis),
          );
          const expiresAt = instantAfter(now, options.lifetimeMs);
          const issued = credential(
            'pct',
            idSource.next(),
            secretSource.next(),
          );
          const tickets = liveTicketIssued(
            liveTickets.read(),
            {
              id: issued.id,
              secretHash: sha256Hex(issued.secret),
              deviceId: viewer.deviceId,
              route: input.route,
              expiresAt,
            },
            now,
            options,
          );
          if (tickets === undefined)
            return yield* Effect.fail(new TooManyLiveTicketsError());
          liveTickets.save(tickets);
          return { ticket: issued.token, expiresAt };
        }),
      };
    }),
  );
}

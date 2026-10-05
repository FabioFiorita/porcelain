import { Effect } from 'effect';
import type { Clock, IdSource, SecretSource } from '@porcelain/kernel/ports';
import { instantAfter, sha256Hex } from '@porcelain/kernel/rules';
import { DeviceViewerRequiredError } from '../errors/device-viewer-required-error.ts';
import { TooManyLiveTicketsError } from '../errors/too-many-live-tickets-error.ts';
import type {
  IssueLiveTicketInput,
  IssueLiveTicketOptions,
  IssueLiveTicketResult,
} from '../models/issue-live-ticket.ts';
import type { LiveTicketStore } from '../ports/live-ticket-store.ts';
import { credential } from '../rules/credential.ts';
import { liveTicketIssued } from '../rules/live-tickets.ts';

export class IssueLiveTicketService {
  private readonly liveTickets: LiveTicketStore;
  private readonly clock: Clock;
  private readonly idSource: IdSource;
  private readonly secretSource: SecretSource;
  private readonly options: IssueLiveTicketOptions;

  constructor(
    liveTickets: LiveTicketStore,
    clock: Clock,
    idSource: IdSource,
    secretSource: SecretSource,
    options: IssueLiveTicketOptions,
  ) {
    this.liveTickets = liveTickets;
    this.clock = clock;
    this.idSource = idSource;
    this.secretSource = secretSource;
    this.options = options;
  }

  execute(
    input: IssueLiveTicketInput,
  ): Effect.Effect<
    IssueLiveTicketResult,
    DeviceViewerRequiredError | TooManyLiveTicketsError
  > {
    return Effect.gen({ self: this }, function* () {
      const { viewer } = input;
      if (viewer.kind !== 'device')
        return yield* Effect.fail(new DeviceViewerRequiredError());
      const now = this.clock.now();
      const expiresAt = instantAfter(now, this.options.lifetimeMs);
      const issued = credential(
        'pct',
        this.idSource.next(),
        this.secretSource.next(),
      );
      const tickets = liveTicketIssued(
        this.liveTickets.read(),
        {
          id: issued.id,
          secretHash: sha256Hex(issued.secret),
          deviceId: viewer.deviceId,
          route: input.route,
          expiresAt,
        },
        now,
        this.options,
      );
      if (tickets === undefined)
        return yield* Effect.fail(new TooManyLiveTicketsError());
      this.liveTickets.save(tickets);
      return { ticket: issued.token, expiresAt };
    });
  }
}

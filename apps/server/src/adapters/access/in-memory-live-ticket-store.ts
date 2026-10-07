import { Effect, Layer } from 'effect';
import type { LiveTickets } from '@porcelain/access/models';
import { LiveTicketStore } from '@porcelain/access/ports';

export const inMemoryLiveTicketStoreLayer = Layer.effect(
  LiveTicketStore,
  Effect.sync(() => {
    let tickets: LiveTickets = { tickets: [] };
    return {
      read(): LiveTickets {
        return tickets;
      },
      save(input: LiveTickets): void {
        tickets = input;
      },
    };
  }),
);

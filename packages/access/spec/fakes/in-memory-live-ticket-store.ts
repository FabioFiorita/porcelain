import type { LiveTickets } from '../../src/models/live-ticket.ts';
import type { LiveTicketStore } from '../../src/ports/live-ticket-store.ts';

export class InMemoryLiveTicketStore implements LiveTicketStore {
  private tickets: LiveTickets = { tickets: [] };

  read(): LiveTickets {
    return this.tickets;
  }

  save(input: LiveTickets): void {
    this.tickets = input;
  }
}

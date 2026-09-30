import type { LiveTickets } from '@porcelain/access/models';
import type { LiveTicketStore } from '@porcelain/access/ports';

export class InMemoryLiveTicketStore implements LiveTicketStore {
  private tickets: LiveTickets = { tickets: [] };

  read(): LiveTickets {
    return this.tickets;
  }

  save(input: LiveTickets): void {
    this.tickets = input;
  }
}

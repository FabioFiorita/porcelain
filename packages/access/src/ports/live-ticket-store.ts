import type { LiveTickets } from '../models/live-ticket.ts';

export interface LiveTicketStore {
  read(): LiveTickets;
  save(input: LiveTickets): void;
}

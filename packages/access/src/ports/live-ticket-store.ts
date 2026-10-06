import { Context } from 'effect';
import type { LiveTickets } from '../models/live-ticket.ts';

export interface LiveTicketStore {
  read(): LiveTickets;
  save(input: LiveTickets): void;
}

export const LiveTicketStore = Context.Service<
  '@porcelain/access/LiveTicketStore',
  LiveTicketStore
>('@porcelain/access/LiveTicketStore');

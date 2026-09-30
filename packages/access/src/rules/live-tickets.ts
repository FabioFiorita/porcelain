import type {
  LiveTickets,
  LiveTicketTaken,
  StoredLiveTicket,
} from '../models/live-ticket.ts';

function unexpired(ticket: StoredLiveTicket, now: string): boolean {
  return Date.parse(ticket.expiresAt) > Date.parse(now);
}

export function liveTicketIssued(
  current: LiveTickets,
  ticket: StoredLiveTicket,
  now: string,
  maxOutstanding: number,
): LiveTickets {
  const kept = current.tickets.filter((entry) => unexpired(entry, now));
  return { tickets: [...kept, ticket].slice(-maxOutstanding) };
}

export function liveTicketTaken(
  current: LiveTickets,
  id: string,
  now: string,
): LiveTicketTaken {
  const found = current.tickets.find((entry) => entry.id === id);
  return {
    tickets: {
      tickets: current.tickets.filter(
        (entry) => entry.id !== id && unexpired(entry, now),
      ),
    },
    ticket: found && unexpired(found, now) ? found : undefined,
  };
}

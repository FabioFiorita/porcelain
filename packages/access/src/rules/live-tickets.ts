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
  limits: { maxOutstanding: number; maxPerDevice: number },
): LiveTickets | undefined {
  const kept = current.tickets.filter((entry) => unexpired(entry, now));
  const own = kept.filter((entry) => entry.deviceId === ticket.deviceId);
  const forgotten = new Set(
    own.slice(0, Math.max(0, own.length - limits.maxPerDevice + 1)),
  );
  const remaining = kept.filter((entry) => !forgotten.has(entry));
  if (remaining.length >= limits.maxOutstanding) return undefined;
  return { tickets: [...remaining, ticket] };
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

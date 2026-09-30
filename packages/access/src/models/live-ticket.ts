import type { DeviceRoute } from './device.ts';

export type StoredLiveTicket = {
  id: string;
  secretHash: string;
  deviceId: string;
  route: DeviceRoute;
  expiresAt: string;
};

export type LiveTickets = { tickets: readonly StoredLiveTicket[] };

export type LiveTicketTaken = {
  tickets: LiveTickets;
  ticket: StoredLiveTicket | undefined;
};

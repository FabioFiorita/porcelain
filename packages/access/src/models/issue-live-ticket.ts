import type { DeviceRoute } from './device.ts';
import type { Redacted } from 'effect';

type LiveTicketViewer =
  | { kind: 'owner' }
  | { kind: 'device'; deviceId: string };

export type IssueLiveTicketInput = {
  viewer: LiveTicketViewer;
  route: DeviceRoute;
};

export type IssueLiveTicketResult = {
  ticket: Redacted.Redacted<string>;
  expiresAt: string;
};

export type IssueLiveTicketOptions = {
  lifetimeMs: number;
  maxOutstanding: number;
  maxPerDevice: number;
};

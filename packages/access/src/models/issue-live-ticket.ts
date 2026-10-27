import type { DeviceRoute } from './device.ts';
import type { Redacted } from 'effect';
import type { Viewer } from './viewer.ts';

export type IssueLiveTicketInput = {
  viewer: Viewer;
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

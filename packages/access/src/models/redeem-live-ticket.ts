import type { DeviceRoute } from './device.ts';

export type RedeemLiveTicketInput = { ticket: string; route: DeviceRoute };

export type RedeemLiveTicketResult =
  | { kind: 'authenticated'; deviceId: string }
  | { kind: 'refused' };

export type RedeemLiveTicketOptions = { unusedLifetimeMs: number };

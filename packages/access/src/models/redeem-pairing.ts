import type { Device } from './device.ts';

export type RedeemPairingInput = {
  code: string;
  platform: string;
  label?: string | undefined;
};

export type RedeemPairingResult = { device: Device; credential: string };

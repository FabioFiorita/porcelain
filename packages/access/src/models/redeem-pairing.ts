import type { Device, DeviceDetailLimits, DeviceRoute } from './device.ts';

export type RedeemPairingInput = {
  code: string;
  platform: string;
  route: DeviceRoute;
  label?: string | undefined;
};

export type RedeemPairingResult = { device: Device; credential: string };

export type RedeemPairingOptions = DeviceDetailLimits;

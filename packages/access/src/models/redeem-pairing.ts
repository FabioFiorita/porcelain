import type { Device, DeviceDetailLimits, DeviceRoute } from './device.ts';
import type { Redacted } from 'effect';

export type RedeemPairingInput = {
  code: string;
  platform: string;
  route: DeviceRoute;
  label?: string | undefined;
};

export type RedeemPairingResult = {
  device: Device;
  credential: Redacted.Redacted<string>;
};

export type RedeemPairingOptions = DeviceDetailLimits;

import type { Device } from './device.ts';
import type { PairingGrant } from './pairing-grant.ts';

export type ListAccessInput = { viewerDeviceId?: string | undefined };

type ListedDevice = Device & {
  trusted: boolean;
  current?: boolean | undefined;
};

export type ListAccessResult = {
  grants: (PairingGrant & { trusted: boolean })[];
  devices: ListedDevice[];
};

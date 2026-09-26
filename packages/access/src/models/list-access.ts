import type { Device } from './device.ts';
import type { PairingGrant } from './pairing-grant.ts';

export type ListAccessResult = { grants: PairingGrant[]; devices: Device[] };

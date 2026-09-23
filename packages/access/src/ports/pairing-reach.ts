import type { HostPolicy } from '../models/origin-policy.ts';

export type PairingReach = { port: number; policy: HostPolicy };

export interface PairingReachPort {
  current(): PairingReach;
}

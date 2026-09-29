import type { HostPolicy } from './host-policy.ts';

export type PairingReach = {
  port: number;
  policy: HostPolicy;
  origins?: readonly string[] | undefined;
};

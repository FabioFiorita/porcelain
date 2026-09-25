import type { Inventory } from '@/features/projects/index';

export type PairingCode = { code: string; environmentId: string };

export type PairingPort = {
  redeem(request: PairingCode & { signal: AbortSignal }): Promise<Inventory>;
};

import type { Inventory } from '../../domain/inventory';

export type PairingCode = { code: string; environmentId: string };

export type PairingPort = {
  redeem(request: PairingCode & { signal: AbortSignal }): Promise<Inventory>;
};

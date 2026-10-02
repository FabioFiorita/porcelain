import type { Transport } from '../../../shared/api/transport.ts';

export type InventoryConnection = {
  environmentId: string;
  transport: Transport;
  request: (signal?: AbortSignal) => { signal: AbortSignal };
  cacheIdentity?: readonly string[];
};

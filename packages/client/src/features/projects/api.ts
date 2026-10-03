import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { perConnection } from '../../shared/api/per-connection.ts';
import { requestJson } from '../../shared/api/request.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createInventoryApi(transport: Transport) {
  return {
    read: (signal: AbortSignal) =>
      requestJson(transport, '/api/inventory', readInventoryResponseSchema, {
        signal,
      }),
  };
}

export const inventoryApi = perConnection(createInventoryApi);

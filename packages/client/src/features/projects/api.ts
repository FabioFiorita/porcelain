import { readInventoryEndpoint } from '@porcelain/contracts/projects';

import { perConnection } from '../../shared/api/per-connection.ts';
import { requestEndpoint } from '../../shared/api/request.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createInventoryApi(transport: Transport) {
  return {
    read: ({ signal }: { signal: AbortSignal }) =>
      requestEndpoint(transport, readInventoryEndpoint, { signal }),
  };
}

export const inventoryApi = perConnection(createInventoryApi);

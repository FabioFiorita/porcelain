import { readInventoryEndpoint } from '@porcelain/contracts/projects';

import { perConnection } from '../../shared/api/per-connection.ts';
import {
  requestEndpoint,
  type EndpointArguments,
} from '../../shared/api/request.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createInventoryApi(transport: Transport) {
  return {
    read: ({ signal }: EndpointArguments<typeof readInventoryEndpoint>) =>
      requestEndpoint(transport, readInventoryEndpoint, { signal }),
  };
}

export const inventoryApi = perConnection(createInventoryApi);

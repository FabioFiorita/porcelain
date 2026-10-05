import { ChangesApi } from '@porcelain/contracts/changes';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { perConnection } from '../../shared/api/per-connection.ts';
import { transportClient } from '../../shared/api/effect-client.ts';
import type { Transport } from '../../shared/api/transport.ts';

function createChangesApi(transport: Transport) {
  return Effect.runSync(
    HttpApiClient.makeWith(ChangesApi, {
      httpClient: transportClient(transport),
    }),
  ).changes;
}
export const changesApi = perConnection(createChangesApi);

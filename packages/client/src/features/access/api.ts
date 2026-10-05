import type { Transport } from '../../shared/api/transport.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import {
  AccessApi,
  LiveUpdatesApi,
  PairingApi,
} from '@porcelain/contracts/access';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { transportClient } from '../../shared/api/effect-client.ts';

function createAccessApi(transport: Transport) {
  return Effect.runSync(
    HttpApiClient.makeWith(AccessApi, {
      httpClient: transportClient(transport),
    }),
  );
}
export const accessApi = perConnection(createAccessApi);
export const liveUpdatesUrl =
  HttpApiClient.urlBuilder(LiveUpdatesApi).live.liveUpdates;
export const redeemPairingUrl =
  HttpApiClient.urlBuilder(PairingApi).pairing.redeemPairing;

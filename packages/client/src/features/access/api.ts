import { LiveUpdatesApi, PairingApi } from '@porcelain/contracts/access';
import { HttpApiClient } from 'effect/http-api';
export const liveUpdatesUrl =
  HttpApiClient.urlBuilder(LiveUpdatesApi).live.liveUpdates;
export const redeemPairingUrl =
  HttpApiClient.urlBuilder(PairingApi).pairing.redeemPairing;

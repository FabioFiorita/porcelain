import { ReviewsApi } from '@porcelain/contracts/reviews';
import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { transportClient } from '../../shared/api/effect-client.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import type { Transport } from '../../shared/api/transport.ts';

export const reviewsApi = perConnection(
  (transport: Transport) =>
    Effect.runSync(
      HttpApiClient.makeWith(ReviewsApi, {
        httpClient: transportClient(transport),
      }),
    ).reviews,
);

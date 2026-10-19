import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { ReviewSummaryApi } from '@porcelain/contracts/reviews';
import type { RuntimeConnection } from '../../shared/api/connection.ts';
import {
  mapRequestErrors,
  transportLayer,
} from '../../shared/api/effect-client.ts';
import type { Transport } from '../../shared/api/transport.ts';
import type { ReviewResponse } from './rules/review.ts';

export type SummaryDelivery = { url: string; transport: Transport };

export const readSummaryHtml = Effect.fn('Reviews.readSummaryHtml')(function* (
  connection: RuntimeConnection,
  summary: ReviewResponse['summary'],
  delivery: SummaryDelivery | undefined,
) {
  const read = Effect.gen(function* () {
    const api = yield* HttpApiClient.make(ReviewSummaryApi);
    return yield* connection.request(
      mapRequestErrors(
        api.reviewSummary.readReviewSummary({
          params: { token: summary.token },
          query: { expires: summary.expires, signature: summary.signature },
        }),
      ),
    );
  });
  return yield* read.pipe(
    Effect.provide(
      transportLayer(
        delivery
          ? (_path, init) => delivery.transport(delivery.url, init)
          : connection.transport,
      ),
    ),
  );
});

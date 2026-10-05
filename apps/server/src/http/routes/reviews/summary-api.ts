import { ReviewSummaryApi } from '@porcelain/contracts/reviews';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import type { ReadReviewSummaryUseCase } from '../../../use-cases/reviews/read-review-summary.ts';
import { summaryPage } from '../../presenters/summary-page.ts';
import { effectRoutes } from '../../effect-bridge.ts';

export function summaryRoutes(
  useCase: Pick<ReadReviewSummaryUseCase, 'execute'>,
) {
  const handlers = HttpApiBuilder.group(
    ReviewSummaryApi,
    'reviewSummary',
    (handlers) =>
      handlers.handle('readReviewSummary', ({ params, query }) =>
        useCase.execute({ ...params, ...query }).pipe(Effect.map(summaryPage)),
      ),
  );
  return effectRoutes(
    ReviewSummaryApi,
    HttpApiBuilder.layer(ReviewSummaryApi).pipe(Layer.provide(handlers)),
  );
}

import { requestBody } from '../../hooks/request-body.ts';
import { handlerAudit } from '../../diagnostics.ts';
import { ReviewSummaryApi } from '@porcelain/contracts/reviews';
import type { Context } from 'effect';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { type ReadReviewSummaryUseCase } from '../../../use-cases/reviews/read-review-summary.ts';
import { summaryPage } from '../../presenters/summary-page.ts';

export function summaryRoutes(
  useCase: Pick<
    Context.Service.Shape<typeof ReadReviewSummaryUseCase>,
    'execute'
  >,
) {
  const handlers = HttpApiBuilder.group(
    ReviewSummaryApi,
    'reviewSummary',
    (handlers) =>
      handlers.handle('readReviewSummary', ({ params, query }) =>
        useCase.execute({ ...params, ...query }).pipe(Effect.map(summaryPage)),
      ),
  );
  return HttpApiBuilder.layer(ReviewSummaryApi).pipe(
    Layer.provide(handlers),
    Layer.provide(handlerAudit.layer),
    Layer.provide(requestBody.layer),
  );
}

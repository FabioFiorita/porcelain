import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import { ReviewSummaryNotFoundError } from '@porcelain/reviews/errors';
import { porcelainApi } from '../shared/http-api.ts';
import {
  readReviewSummaryParamsSchema,
  readReviewSummaryQuerySchema,
  readReviewSummaryResponseSchema,
} from './review-summary.ts';

export class ReviewSummaryApi extends porcelainApi.add(
  HttpApiGroup.make('reviewSummary').add(
    HttpApiEndpoint.get('readReviewSummary', '/review-summaries/:token', {
      disableCodecs: true,
      params: readReviewSummaryParamsSchema,
      query: readReviewSummaryQuerySchema.fields,
      success: readReviewSummaryResponseSchema.pipe(
        HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' }),
      ),
      error: ReviewSummaryNotFoundError.pipe(
        HttpApiSchema.asNoContent({
          decode: () => new ReviewSummaryNotFoundError(),
        }),
        HttpApiSchema.status('NotFound'),
      ),
    }),
  ),
) {}

import { isoDateTimeSchema } from '../shared/schema.ts';
import { Schema } from 'effect';

export const readReviewSummaryParamsSchema = Schema.Struct({
  token: Schema.String.check(Schema.isUUID()),
});
export const readReviewSummaryQuerySchema = Schema.Struct({
  expires: isoDateTimeSchema,
  signature: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
});
export const readReviewSummaryResponseSchema = Schema.String;

export type ReadReviewSummaryParams = typeof readReviewSummaryParamsSchema.Type;
export type ReadReviewSummaryQuery = typeof readReviewSummaryQuerySchema.Type;
export type ReadReviewSummaryResponse =
  typeof readReviewSummaryResponseSchema.Type;

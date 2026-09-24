import { z } from 'zod';

export const readReviewSummaryParamsSchema = z.strictObject({
  token: z.uuid(),
});
export const readReviewSummaryQuerySchema = z.strictObject({
  expires: z.iso.datetime(),
  signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const readReviewSummaryResponseSchema = z.string();
export const readReviewSummaryNotFoundResponseSchema = z.undefined();

export type ReadReviewSummaryParams = z.output<
  typeof readReviewSummaryParamsSchema
>;
export type ReadReviewSummaryQuery = z.output<
  typeof readReviewSummaryQuerySchema
>;
export type ReadReviewSummaryResponse = z.output<
  typeof readReviewSummaryResponseSchema
>;

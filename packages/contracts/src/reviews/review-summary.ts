import { z } from 'zod';

export const reviewSummaryParamsSchema = z.strictObject({ token: z.uuid() });
export const reviewSummaryQuerySchema = z.strictObject({
  expires: z.coerce.number().int().positive(),
  signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const reviewSummaryHtmlSchema = z.string();
export const reviewSummaryNotFoundSchema = z.undefined();

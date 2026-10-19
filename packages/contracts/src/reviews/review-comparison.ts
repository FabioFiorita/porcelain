import { Schema } from 'effect';
import {
  reviewComparisonSchema,
  comparisonUnknownSchema,
} from '@porcelain/reviews/models';
import { nullableAsUndefined } from '../shared/schema.ts';
import { relativePathSchema } from '../shared/relative-path.ts';
import { readBranchDiffsResponseSchema } from '../changes/branch-changes.ts';

const revision = Schema.FiniteFromString.check(Schema.isInt()).check(
  Schema.isGreaterThan(0),
);
export const compareReviewQuerySchema = Schema.Struct({
  from: Schema.optional(revision),
  to: Schema.optional(revision),
});
export const compareReviewResponseSchema = Schema.Struct({
  reviewId: Schema.String.check(Schema.isUUID()),
  from: nullableAsUndefined(Schema.Int),
  to: Schema.Int,
  comparison: nullableAsUndefined(reviewComparisonSchema),
  unknown: Schema.Array(comparisonUnknownSchema),
});
export const readReviewInterdiffQuerySchema = Schema.Struct({
  ...compareReviewQuerySchema.fields,
  path: relativePathSchema,
});
export const readReviewInterdiffResponseSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('diff'),
    from: Schema.Int,
    to: Schema.Int,
    path: relativePathSchema,
    ...readBranchDiffsResponseSchema.fields,
  }),
  Schema.Struct({
    kind: Schema.Literal('unavailable'),
    reason: Schema.Literals([
      'no-baseline',
      'path-not-reviewed',
      'not-changed',
      'missing-head-blob',
    ]),
  }),
]);
export type CompareReviewResponse = typeof compareReviewResponseSchema.Type;
export type ReadReviewInterdiffResponse =
  typeof readReviewInterdiffResponseSchema.Type;

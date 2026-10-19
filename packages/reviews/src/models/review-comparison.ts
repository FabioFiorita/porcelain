import { Schema } from 'effect';
import type { Review } from './review.ts';
import {
  reviewRecommendationSchema,
  reviewRemovalSchema,
  reviewNotProvenSchema,
} from './review.ts';
import { proofCheckSchema } from './review-proof.ts';
import type { ReviewMarks } from './review-management.ts';
import type { CommentThread } from './comment-thread.ts';

const stringArraySchema = Schema.Array(Schema.String);
const markSchema = Schema.Struct({
  path: Schema.String,
  headBlobOid: Schema.String,
});
const decisionMarkSchema = Schema.Struct({
  layerId: Schema.String,
  fingerprint: Schema.String,
});
export const comparisonUnknownSchema = Schema.Struct({
  area: Schema.Literals(['baseline', 'file-marks', 'conversation', 'proof']),
  reason: Schema.String,
  ids: stringArraySchema,
});
export const reviewComparisonSchema = Schema.Struct({
  files: Schema.Array(
    Schema.Union([
      Schema.Struct({
        path: Schema.String,
        change: Schema.Literals(['entered', 'left']),
      }),
      Schema.Struct({
        path: Schema.String,
        change: Schema.Literals(['changed', 'unchanged']),
        headChanged: Schema.Boolean,
        baseChanged: Schema.Boolean,
      }),
    ]),
  ),
  decisions: Schema.Struct({
    affected: stringArraySchema,
    new: stringArraySchema,
    gone: stringArraySchema,
    resetMarks: Schema.Array(decisionMarkSchema),
  }),
  fileMarks: Schema.Struct({
    carriedCount: Schema.Int,
    carried: Schema.Array(markSchema),
    reset: Schema.Array(markSchema),
  }),
  verdict: Schema.Struct({
    recommendation: Schema.Struct({
      from: reviewRecommendationSchema,
      to: reviewRecommendationSchema,
    }),
    removed: Schema.Struct({
      added: Schema.Array(reviewRemovalSchema),
      dropped: Schema.Array(reviewRemovalSchema),
    }),
    deletedFiles: Schema.Struct({
      added: stringArraySchema,
      dropped: stringArraySchema,
    }),
    notProven: Schema.Struct({
      added: Schema.Array(reviewNotProvenSchema),
      dropped: Schema.Array(reviewNotProvenSchema),
    }),
  }),
  conversation: Schema.Struct({
    agentMessageCount: Schema.Int,
    agentThreadIds: stringArraySchema,
    agentMessages: Schema.Array(
      Schema.Struct({
        threadId: Schema.String,
        messageId: Schema.String,
        body: Schema.String,
        createdAt: Schema.String,
      }),
    ),
    resolvedThreadCount: Schema.Int,
    resolvedThreadIds: stringArraySchema,
  }),
  proof: Schema.Struct({
    publishedChecks: Schema.Array(proofCheckSchema),
    changedResults: Schema.Array(
      Schema.Struct({ from: proofCheckSchema, to: proofCheckSchema }),
    ),
  }),
  unknown: Schema.Array(comparisonUnknownSchema),
});
export type ReviewComparison = typeof reviewComparisonSchema.Type;
export type ComparisonUnknown = typeof comparisonUnknownSchema.Type;
export type CompareReviewInput = {
  reviewId: string;
  from?: number | undefined;
  to?: number | undefined;
};
export type ReviewComparisonSelection = {
  from: Review | undefined;
  to: Review;
};
export type CompareReviewResult = {
  reviewId: string;
  from: number | undefined;
  to: number;
  comparison: ReviewComparison | undefined;
  unknown: readonly ComparisonUnknown[];
};
export type ReviewComparisonContext = {
  marks: ReviewMarks;
  threads: readonly CommentThread[];
};

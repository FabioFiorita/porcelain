import { Schema } from 'effect';
import {
  reviewAgentFeedbackStateSchema,
  reviewAgentSessionSchema,
} from '@porcelain/reviews/models';
import { reviewParamsSchema } from './review.ts';

export const reviewAgentFeedbackResponseSchema = Schema.Struct({
  ...reviewAgentFeedbackStateSchema.fields,
  acknowledgementAccepted: Schema.optional(Schema.Boolean),
  currentCommentRevision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const sendReviewAgentFeedbackRequestSchema = Schema.Struct({
  reviewRevision: Schema.Int.check(Schema.isGreaterThan(0)),
});

export const connectReviewAgentRequestSchema = Schema.Struct({
  ...reviewParamsSchema.fields,
  session: Schema.Struct({
    ...reviewAgentSessionSchema.fields,
    threadId: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(2048),
      Schema.isPattern(/^\S[^\0]*$/),
    ),
  }),
});

export const acknowledgeFeedbackRequestSchema = Schema.Struct({
  ...reviewParamsSchema.fields,
  deliveryId: Schema.String.check(Schema.isUUID()),
});

export type ReviewAgentFeedbackResponse =
  typeof reviewAgentFeedbackResponseSchema.Type;
export type { ReviewAgentFeedbackOperation } from '@porcelain/reviews/models';

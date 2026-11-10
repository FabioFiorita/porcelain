import { Schema } from 'effect';
import { reviewAgentFeedbackStateSchema } from '@porcelain/reviews/models';

export const reviewAgentFeedbackResponseSchema = Schema.Struct({
  ...reviewAgentFeedbackStateSchema.fields,
  acknowledgementAccepted: Schema.optional(Schema.Boolean),
  currentCommentRevision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type ReviewAgentFeedbackResponse =
  typeof reviewAgentFeedbackResponseSchema.Type;

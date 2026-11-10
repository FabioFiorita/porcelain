import { Schema } from 'effect';

export const reviewAgentSessionSchema = Schema.Struct({
  kind: Schema.Literal('t3'),
  threadId: Schema.String,
});

export const reviewAgentFeedbackDeliverySchema = Schema.Struct({
  id: Schema.String,
  reviewId: Schema.String,
  reviewRevision: Schema.Int,
  commentRevision: Schema.Int,
  state: Schema.Literals(['pending', 'delivered', 'acknowledged']),
  attempted: Schema.Boolean,
  error: Schema.optional(Schema.String),
});

export const reviewAgentFeedbackStateSchema = Schema.Struct({
  session: Schema.optional(reviewAgentSessionSchema),
  delivery: Schema.optional(reviewAgentFeedbackDeliverySchema),
});

export type ReviewAgentSession = typeof reviewAgentSessionSchema.Type;
export type ReviewAgentFeedbackState =
  typeof reviewAgentFeedbackStateSchema.Type;

import { Schema } from 'effect';
import { Model } from 'effect/schema';
import {
  reviewAgentSessionSchema,
  reviewAgentFeedbackDeliverySchema,
} from '@porcelain/reviews/models';

export class ReviewAgentFeedbackRow extends Model.Class<ReviewAgentFeedbackRow>(
  'ReviewAgentFeedbackRow',
)({
  reviewId: Schema.String,
  session: Schema.fromJsonString(reviewAgentSessionSchema),
  delivery: Schema.NullOr(
    Schema.fromJsonString(reviewAgentFeedbackDeliverySchema),
  ),
}) {
  static readonly tableName = 'review_agent_feedback';
}

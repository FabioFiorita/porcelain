import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class ReviewedLayerRow extends Model.Class<ReviewedLayerRow>(
  'ReviewedLayerRow',
)({
  reviewId: Schema.String,
  layerId: Schema.String,
  fingerprint: Schema.String,
  reviewedAt: Schema.String,
}) {
  static readonly tableName = 'reviewed_layers';
}

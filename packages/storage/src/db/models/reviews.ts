import { Schema } from 'effect';
import { Model } from 'effect/schema';
import {
  reviewDiagramSchema,
  reviewLayerSchema,
  reviewProofSchema,
} from '@porcelain/reviews/models';
export class ReviewRow extends Model.Class<ReviewRow>('ReviewRow')({
  worktreeId: Schema.String,
  revision: Schema.Int,
  publishedAt: Schema.String,
  active: Schema.BooleanFromBit,
  summaryHtml: Schema.String,
  summaryToken: Schema.String,
  summarySecret: Schema.String,
  diagram: Schema.NullOr(Schema.fromJsonString(reviewDiagramSchema)),
  layers: Schema.fromJsonString(Schema.Array(reviewLayerSchema)),
  proof: Schema.NullOr(Schema.fromJsonString(reviewProofSchema)),
}) {
  static readonly tableName = 'reviews';
}

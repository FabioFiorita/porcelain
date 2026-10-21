import { Schema } from 'effect';
import { Model } from 'effect/schema';
import {
  reviewDiagramSchema,
  reviewLayerSchema,
  reviewProofSchema,
  reviewFileSchema,
  unexplainedChangeSchema,
  reviewVerdictSchema,
  reviewRecordSchema,
} from '@porcelain/reviews/models';
export class ReviewRow extends Model.Class<ReviewRow>('ReviewRow')({
  reviewId: Schema.String,
  projectId: Schema.String,
  commonDirectory: Schema.String,
  worktreeId: Schema.String,
  worktreePath: Schema.String,
  worktreeName: Schema.String,
  branch: Schema.String,
  headOid: Schema.String,
  base: Schema.String,
  baseOid: Schema.String,
  mergeBaseOid: Schema.String,
  files: Schema.fromJsonString(Schema.Array(reviewFileSchema)),
  notExplained: Schema.fromJsonString(Schema.Array(unexplainedChangeSchema)),
  verdict: Schema.fromJsonString(reviewVerdictSchema),
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
  static readonly tableName = 'review_revisions';
}

export class ReviewRecordRow extends Model.Class<ReviewRecordRow>(
  'ReviewRecordRow',
)({
  reviewId: Schema.String,
  projectId: Schema.String,
  commonDirectory: Schema.String,
  branch: Schema.String,
  pullRequest: Schema.NullOr(Schema.String),
  pullRequestNumber: Schema.NullOr(Schema.Int),
  state: Schema.Literals(['open', 'closed']),
  archived: Schema.BooleanFromBit,
  latestRevision: reviewRecordSchema.fields.latestRevision,
}) {
  static readonly tableName = 'reviews';
}

export class ReviewSeenRow extends Model.Class<ReviewSeenRow>('ReviewSeenRow')({
  reviewId: Schema.String,
  lastSeenRevision: Schema.Int,
}) {
  static readonly tableName = 'review_seen';
}

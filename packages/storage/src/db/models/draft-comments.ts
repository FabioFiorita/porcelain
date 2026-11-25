import { Schema } from 'effect';
import { Model } from 'effect/schema';
import { draftCommentAnchorSchema } from '@porcelain/reviews/models';
export class DraftCommentRow extends Model.Class<DraftCommentRow>(
  'DraftCommentRow',
)({
  sequence: Model.GeneratedByDb(Schema.Int),
  id: Schema.String,
  worktreeId: Schema.String,
  branch: Schema.String,
  headOid: Schema.String,
  anchor: Schema.fromJsonString(draftCommentAnchorSchema),
  text: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  publishedUrl: Schema.NullOr(Schema.String),
  publishedAt: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'draft_comments';
}

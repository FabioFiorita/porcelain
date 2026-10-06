import { Schema } from 'effect';
import { Model } from 'effect/schema';
import {
  commentAnchorSchema,
  commentAuthorRoleSchema,
} from '@porcelain/reviews/models';
export class CommentThreadRow extends Model.Class<CommentThreadRow>(
  'CommentThreadRow',
)({
  sequence: Model.GeneratedByDb(Schema.Int),
  id: Schema.String,
  worktreeId: Schema.String,
  anchor: Schema.fromJsonString(commentAnchorSchema),
  resolved: Schema.BooleanFromBit,
  revision: Schema.Int,
  lastAgentRevision: Schema.NullOr(Schema.Int),
  sizeBytes: Schema.Int,
}) {
  static readonly tableName = 'comment_threads';
}

export class CommentMessageRow extends Model.Class<CommentMessageRow>(
  'CommentMessageRow',
)({
  sequence: Model.GeneratedByDb(Schema.Int),
  id: Schema.String,
  threadId: Schema.String,
  worktreeId: Schema.String,
  body: Schema.String,
  author: commentAuthorRoleSchema,
  createdAt: Schema.NullOr(Schema.String),
  editedAt: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'comment_messages';
}

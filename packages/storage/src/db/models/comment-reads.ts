import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class CommentSeenRow extends Model.Class<CommentSeenRow>(
  'CommentSeenRow',
)({
  worktreeId: Schema.String,
  seenThrough: Schema.Int,
}) {
  static readonly tableName = 'comment_reads';
}

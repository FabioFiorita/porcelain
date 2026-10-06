import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class CommentRevisionRow extends Model.Class<CommentRevisionRow>(
  'CommentRevisionRow',
)({
  singleton: Schema.Int,
  revision: Schema.Int,
}) {
  static readonly tableName = 'comment_revision';
}

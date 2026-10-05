import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class ReviewedFileRow extends Model.Class<ReviewedFileRow>(
  'ReviewedFileRow',
)({
  worktreeId: Schema.String,
  scope: Schema.Literals(['worktree', 'branch']),
  branch: Schema.String,
  path: Schema.String,
  fingerprint: Schema.String,
  reviewedAt: Schema.String,
  stale: Schema.BooleanFromBit,
}) {
  static readonly tableName = 'reviewed_files';
}

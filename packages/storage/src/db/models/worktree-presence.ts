import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class WorktreePresenceRow extends Model.Class<WorktreePresenceRow>(
  'WorktreePresenceRow',
)({
  worktreeId: Schema.String,
  projectId: Schema.String,
  missingSince: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'worktree_presence';
}

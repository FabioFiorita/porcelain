import { Schema } from 'effect';
import { Model } from 'effect/schema';
import {
  gitActionIntentSchema,
  gitActionReceiptStateSchema,
  gitActionReasonSchema,
  gitActionExpectationSchema,
  gitActionResultSchema,
} from '@porcelain/git-actions/models';
export class GitActionReceiptRow extends Model.Class<GitActionReceiptRow>(
  'GitActionReceiptRow',
)({
  requestId: Schema.String,
  projectId: Schema.String,
  worktreeId: Schema.String,
  action: Schema.Union(
    gitActionIntentSchema.members.map((member) => member.fields.action),
  ),
  state: gitActionReceiptStateSchema,
  reason: Schema.NullOr(gitActionReasonSchema),
  message: Schema.NullOr(Schema.String),
  refreshRequired: Schema.BooleanFromBit,
  acceptedAt: Schema.String,
  finishedAt: Schema.NullOr(Schema.String),
  dismissedAt: Schema.NullOr(Schema.String),
  intent: Schema.fromJsonString(gitActionIntentSchema),
  expected: Schema.fromJsonString(gitActionExpectationSchema),
  result: Schema.NullOr(Schema.fromJsonString(gitActionResultSchema)),
  progress: Schema.fromJsonString(Schema.mutable(Schema.Array(Schema.String))),
}) {
  static readonly tableName = 'git_action_receipts';
}

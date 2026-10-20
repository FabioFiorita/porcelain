import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class GitHubAccountRow extends Model.Class<GitHubAccountRow>(
  'GitHubAccountRow',
)({
  projectId: Schema.String,
  repository: Schema.String,
  detected: Schema.NullOr(Schema.String),
  override: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'project_github_accounts';
}

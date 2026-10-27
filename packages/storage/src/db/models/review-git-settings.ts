import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class ReviewGitSettingsRow extends Model.Class<ReviewGitSettingsRow>(
  'ReviewGitSettingsRow',
)({
  singleton: Schema.Int,
  revision: Schema.Int,
  settings: Schema.String,
}) {
  static readonly tableName = 'review_git_settings';
}

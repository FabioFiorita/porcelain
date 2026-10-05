import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class FilePreferenceRow extends Model.Class<FilePreferenceRow>(
  'FilePreferenceRow',
)({
  projectId: Schema.String,
  path: Schema.String,
  pinned: Schema.BooleanFromBit,
  hidden: Schema.BooleanFromBit,
}) {
  static readonly tableName = 'project_file_preferences';
}

import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class EnvironmentRow extends Model.Class<EnvironmentRow>(
  'EnvironmentRow',
)({
  singleton: Schema.Int,
  id: Schema.String,
}) {
  static readonly tableName = 'environment';
}

import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class EnvironmentNameRow extends Model.Class<EnvironmentNameRow>(
  'EnvironmentNameRow',
)({
  singleton: Schema.Int,
  name: Schema.String,
}) {
  static readonly tableName = 'environment_name';
}

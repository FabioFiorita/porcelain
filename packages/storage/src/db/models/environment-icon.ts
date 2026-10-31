import { Schema } from 'effect';
import { Model } from 'effect/schema';
import { environmentIconSchema } from '@porcelain/access/models';
export class EnvironmentIconRow extends Model.Class<EnvironmentIconRow>(
  'EnvironmentIconRow',
)({
  singleton: Schema.Int,
  icon: environmentIconSchema,
}) {
  static readonly tableName = 'environment_icon';
}

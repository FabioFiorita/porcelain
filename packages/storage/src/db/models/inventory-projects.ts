import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class InventoryProjectRow extends Model.Class<InventoryProjectRow>(
  'InventoryProjectRow',
)({
  id: Schema.String,
  name: Schema.String,
  namedByOwner: Schema.BooleanFromBit,
  commonDirectory: Schema.String,
  repositoryIdentity: Schema.String,
  available: Schema.BooleanFromBit,
  position: Schema.Int,
}) {
  static readonly tableName = 'inventory_projects';
}

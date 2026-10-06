import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class DeviceRow extends Model.Class<DeviceRow>('DeviceRow')({
  id: Schema.String,
  label: Schema.String,
  platform: Schema.String,
  secretHash: Schema.String,
  createdAt: Schema.String,
  lastSeenAt: Schema.String,
  lastSeenAddress: Schema.NullOr(Schema.String),
  route: Schema.Literals(['loopback', 'lan', 'tailnet', 'tunnel']),
  routeInferred: Schema.BooleanFromBit,
  trusted: Schema.BooleanFromBit,
  revokedAt: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'devices';
}

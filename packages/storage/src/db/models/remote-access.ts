import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class RemoteAccessRow extends Model.Class<RemoteAccessRow>(
  'RemoteAccessRow',
)({
  singleton: Schema.Int,
  lan: Schema.BooleanFromBit,
  lanInterface: Schema.NullOr(Schema.String),
  lanSubnet: Schema.NullOr(Schema.String),
  lanGateway: Schema.NullOr(Schema.String),
  lanGatewayHardware: Schema.NullOr(Schema.String),
  tailnet: Schema.BooleanFromBit,
  tailnetHostname: Schema.NullOr(Schema.String),
  tailnetPort: Schema.NullOr(Schema.Int),
  cloudflare: Schema.BooleanFromBit,
  cloudflareHostname: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'remote_access';
}

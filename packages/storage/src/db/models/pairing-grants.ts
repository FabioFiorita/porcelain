import { Schema } from 'effect';
import { Model } from 'effect/schema';
export class PairingGrantRow extends Model.Class<PairingGrantRow>(
  'PairingGrantRow',
)({
  id: Schema.String,
  label: Schema.String,
  secretHash: Schema.String,
  addresses: Schema.fromJsonString(Schema.mutable(Schema.Array(Schema.String))),
  createdAt: Schema.String,
  expiresAt: Schema.String,
  trusted: Schema.BooleanFromBit,
  redeemedAt: Schema.NullOr(Schema.String),
  revokedAt: Schema.NullOr(Schema.String),
}) {
  static readonly tableName = 'pairing_grants';
}

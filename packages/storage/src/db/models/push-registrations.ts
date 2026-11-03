import { Schema } from 'effect';
import { Model } from 'effect/schema';
import { pushKindSchema, pushPlatformSchema } from '@porcelain/access/models';

export class PushRegistrationRow extends Model.Class<PushRegistrationRow>(
  'PushRegistrationRow',
)({
  deviceId: Schema.String,
  token: Schema.String,
  platform: pushPlatformSchema,
  kinds: Schema.fromJsonString(Schema.Array(pushKindSchema)),
}) {
  static readonly tableName = 'push_registrations';
}

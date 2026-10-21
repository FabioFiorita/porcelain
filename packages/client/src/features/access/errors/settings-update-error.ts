import { Schema } from 'effect';

export class SettingsUpdateError extends Schema.TaggedError<SettingsUpdateError>()(
  'SettingsUpdateError',
  { message: Schema.String },
) {}

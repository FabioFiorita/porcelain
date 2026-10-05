import { Schema } from 'effect';

export class ConnectionError extends Schema.TaggedError<ConnectionError>()(
  'ConnectionError',
  { message: Schema.String, cause: Schema.optionalKey(Schema.Unknown) },
) {}

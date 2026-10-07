import { Schema } from 'effect';

export class OwnerSocketTimeoutError extends Schema.TaggedError<OwnerSocketTimeoutError>()(
  'OwnerSocketTimeoutError',
  {
    message: Schema.String,
  },
) {}

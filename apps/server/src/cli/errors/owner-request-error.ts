import { Schema } from 'effect';

export class OwnerRequestError extends Schema.TaggedError<OwnerRequestError>()(
  'OwnerRequestError',
  {
    message: Schema.String,
  },
) {}

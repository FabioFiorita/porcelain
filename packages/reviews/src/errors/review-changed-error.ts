import { Schema } from 'effect';

export class ReviewChangedError extends Schema.TaggedError<ReviewChangedError>()(
  'ReviewChangedError',
  { message: Schema.String },
) {}

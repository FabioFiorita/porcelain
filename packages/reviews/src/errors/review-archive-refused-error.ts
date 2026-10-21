import { Schema } from 'effect';
export class ReviewArchiveRefusedError extends Schema.TaggedError<ReviewArchiveRefusedError>()(
  'ReviewArchiveRefusedError',
  { message: Schema.String },
) {}

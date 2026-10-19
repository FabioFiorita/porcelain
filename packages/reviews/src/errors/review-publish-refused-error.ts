import { Schema } from 'effect';

export class ReviewPublishRefusedError extends Schema.TaggedError<ReviewPublishRefusedError>()(
  'ReviewPublishRefusedError',
  {
    message: Schema.String,
  },
) {}

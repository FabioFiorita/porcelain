import { Schema } from 'effect';

export class ReviewPullRequestRefusedError extends Schema.TaggedError<ReviewPullRequestRefusedError>()(
  'ReviewPullRequestRefusedError',
  { message: Schema.String },
) {}

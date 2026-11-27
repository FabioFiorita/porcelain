import { Schema } from 'effect';

export class PullRequestReviewFailedError extends Schema.TaggedError<PullRequestReviewFailedError>()(
  'PullRequestReviewFailedError',
  { message: Schema.String },
) {}

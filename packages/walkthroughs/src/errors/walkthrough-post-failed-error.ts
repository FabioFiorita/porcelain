import { Schema } from 'effect';

export class WalkthroughPostFailedError extends Schema.TaggedError<WalkthroughPostFailedError>()(
  'WalkthroughPostFailedError',
  { message: Schema.String },
) {}

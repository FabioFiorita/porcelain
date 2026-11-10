import { Schema } from 'effect';

export class WalkthroughRepositoryChangedError extends Schema.TaggedError<WalkthroughRepositoryChangedError>()(
  'WalkthroughRepositoryChangedError',
  { message: Schema.String },
) {}

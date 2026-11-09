import { Schema } from 'effect';
import { walkthroughFailureSchema } from '../models/walkthrough.ts';
export class WalkthroughFailedError extends Schema.TaggedError<WalkthroughFailedError>()(
  'WalkthroughFailedError',
  { ...walkthroughFailureSchema.fields },
) {}

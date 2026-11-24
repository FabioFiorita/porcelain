import { Schema } from 'effect';
import { unsupportedWalkthroughEffortMessage } from '../rules/walkthrough-writer.ts';

export class UnsupportedWalkthroughEffortError extends Schema.TaggedError<UnsupportedWalkthroughEffortError>()(
  'UnsupportedWalkthroughEffortError',
  { label: Schema.String, effort: Schema.String },
) {
  override get message() {
    return unsupportedWalkthroughEffortMessage(this.label, this.effort);
  }
}

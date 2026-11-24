import { Schema } from 'effect';

export class UnsupportedWalkthroughEffortError extends Schema.TaggedError<UnsupportedWalkthroughEffortError>()(
  'UnsupportedWalkthroughEffortError',
  { label: Schema.String, effort: Schema.String },
) {
  override get message() {
    return `${this.label} doesn't support ${this.effort} effort.`;
  }
}

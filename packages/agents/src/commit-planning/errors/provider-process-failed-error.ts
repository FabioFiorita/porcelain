import { Schema } from 'effect';

export class ProviderProcessFailedError extends Schema.TaggedError<ProviderProcessFailedError>()(
  'ProviderProcessFailedError',
  { cause: Schema.optional(Schema.Unknown) },
) {
  override get message() {
    return 'Commit generation failed. Check that the selected CLI is up to date and signed in.';
  }
}

import { Schema } from 'effect';

export class CommitGenerationFailedError extends Schema.TaggedError<CommitGenerationFailedError>()(
  'CommitGenerationFailedError',
  {},
) {
  override get message() {
    return 'Commit generation failed.';
  }
}

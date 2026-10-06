import { Schema } from 'effect';

export class CommitPlanFailedError extends Schema.TaggedError<CommitPlanFailedError>()(
  'CommitPlanFailedError',
  { cause: Schema.optional(Schema.Unknown) },
) {
  override get message() {
    return 'Commit generation failed.';
  }
}

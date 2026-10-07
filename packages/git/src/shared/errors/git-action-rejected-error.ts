import { Schema } from 'effect';

export class GitActionRejectedError extends Schema.TaggedError<GitActionRejectedError>()(
  'GitActionRejectedError',
  {
    reason: Schema.Literals([
      'CHANGED_SINCE_LOOKED',
      'STALE_PREPARATION',
      'REQUEST_MISMATCH',
      'CHECKOUT_BUSY',
      'UNSUPPORTED_CONFIGURATION',
      'NON_FAST_FORWARD',
      'GIT_REJECTED',
      'DEADLINE_EXCEEDED',
      'OUTCOME_UNKNOWN',
      'PROCESS_GROUP_UNCONFIRMED',
    ]),
    detail: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {
  override get message() {
    return 'Git action rejected';
  }
}

import { Schema } from 'effect';

export class InvalidUpdateJournalError extends Schema.TaggedError<InvalidUpdateJournalError>()(
  'InvalidUpdateJournalError',
  {
    path: Schema.String,
  },
) {
  override get message() {
    return `The interrupted update record at ${this.path} is invalid. Preserve it and the service runtime for manual recovery.`;
  }
}

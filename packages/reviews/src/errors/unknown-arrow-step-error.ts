import { Schema } from 'effect';

export class UnknownArrowStepError extends Schema.TaggedError<UnknownArrowStepError>()(
  'UnknownArrowStepError',
  {},
) {
  override get message() {
    return 'A layer arrow joins a step its layer does not have';
  }
}

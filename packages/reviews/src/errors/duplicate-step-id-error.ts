import { Schema } from 'effect';

export class DuplicateStepIdError extends Schema.TaggedError<DuplicateStepIdError>()(
  'DuplicateStepIdError',
  {},
) {
  override get message() {
    return 'Step IDs repeat within a layer';
  }
}

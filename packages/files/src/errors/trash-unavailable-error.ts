import { Schema } from 'effect';

export class TrashUnavailableError extends Schema.TaggedError<TrashUnavailableError>()(
  'TrashUnavailableError',
  {},
) {
  override get message() {
    return 'This machine has no trash; nothing was deleted';
  }
}

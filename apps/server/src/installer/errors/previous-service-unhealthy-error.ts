import { Schema } from 'effect';

export class PreviousServiceUnhealthyError extends Schema.TaggedError<PreviousServiceUnhealthyError>()(
  'PreviousServiceUnhealthyError',
  {},
) {
  override get message() {
    return 'The previous service was restarted but did not become healthy.';
  }
}

import { Schema } from 'effect';

export class RestoredServiceUnhealthyError extends Schema.TaggedError<RestoredServiceUnhealthyError>()(
  'RestoredServiceUnhealthyError',
  {},
) {
  override get message() {
    return 'The previous service was restored after an interrupted update but did not become healthy.';
  }
}

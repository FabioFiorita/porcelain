import { Schema } from 'effect';

export class TooManyLiveTicketsError extends Schema.TaggedError<TooManyLiveTicketsError>()(
  'TooManyLiveTicketsError',
  {},
) {
  override get message() {
    return 'Too many live tickets are waiting to be used. Try again shortly.';
  }
}

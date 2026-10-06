import { Schema } from 'effect';

export class NoLocalNetworkError extends Schema.TaggedError<NoLocalNetworkError>()(
  'NoLocalNetworkError',
  {},
) {
  override get message() {
    return 'This computer is not on a local network right now, so there is no network to share on.';
  }
}

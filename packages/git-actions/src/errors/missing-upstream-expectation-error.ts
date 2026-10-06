import { Schema } from 'effect';

export class MissingUpstreamExpectationError extends Schema.TaggedError<MissingUpstreamExpectationError>()(
  'MissingUpstreamExpectationError',
  {},
) {
  override get message() {
    return 'This action needs the upstream the client expects';
  }
}

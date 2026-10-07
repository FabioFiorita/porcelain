import { Schema } from 'effect';

export class UpdatedServiceUnhealthyError extends Schema.TaggedError<UpdatedServiceUnhealthyError>()(
  'UpdatedServiceUnhealthyError',
  {},
) {
  override get message() {
    return 'The updated service did not become healthy.';
  }
}

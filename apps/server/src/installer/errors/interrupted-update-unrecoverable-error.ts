import { Schema } from 'effect';

export class InterruptedUpdateUnrecoverableError extends Schema.TaggedError<InterruptedUpdateUnrecoverableError>()(
  'InterruptedUpdateUnrecoverableError',
  {},
) {
  override get message() {
    return 'An interrupted update has neither the installed nor previous runtime. Preserve the service directory for manual recovery.';
  }
}

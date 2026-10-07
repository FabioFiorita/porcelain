import { Schema } from 'effect';

export class InstallerOperationError extends Schema.TaggedError<InstallerOperationError>()(
  'InstallerOperationError',
  {
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

import { Schema } from 'effect';
export class BranchArchiveRefusedError extends Schema.TaggedError<BranchArchiveRefusedError>()(
  'BranchArchiveRefusedError',
  { message: Schema.String },
) {}

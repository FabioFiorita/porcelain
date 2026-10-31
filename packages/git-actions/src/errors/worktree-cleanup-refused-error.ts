import { Schema } from 'effect';
export class WorktreeCleanupRefusedError extends Schema.TaggedError<WorktreeCleanupRefusedError>()(
  'WorktreeCleanupRefusedError',
  { message: Schema.String },
) {}

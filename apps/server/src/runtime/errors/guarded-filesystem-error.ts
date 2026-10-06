import { Data } from 'effect';

export class GuardedFilesystemError extends Data.TaggedError(
  'GuardedFilesystemError',
)<{ readonly cause: unknown }> {}

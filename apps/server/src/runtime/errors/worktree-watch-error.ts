import { Data } from 'effect';

export class WorktreeWatchError extends Data.TaggedError('WorktreeWatchError')<{
  readonly cause: unknown;
}> {}

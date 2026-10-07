import { Data } from 'effect';

export class DesktopError extends Data.TaggedError('DesktopError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

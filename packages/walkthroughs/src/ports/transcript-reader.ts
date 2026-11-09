import { Context, type Effect } from 'effect';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export interface TranscriptReader {
  readonly read: (
    worktreePath: string,
  ) => Effect.Effect<string, WalkthroughFailedError>;
}
export const TranscriptReader = Context.Service<
  '@porcelain/walkthroughs/TranscriptReader',
  TranscriptReader
>('@porcelain/walkthroughs/TranscriptReader');

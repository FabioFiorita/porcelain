import { Context, type Effect } from 'effect';
import type {
  WalkthroughContent,
  WalkthroughEvidence,
  WalkthroughJob,
} from '../models/walkthrough.ts';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export interface WalkthroughWriter {
  readonly write: (
    input: WalkthroughJob & {
      readonly evidence: WalkthroughEvidence;
      readonly transcript: string;
      readonly recordSession: (id: string) => Effect.Effect<void>;
    },
  ) => Effect.Effect<
    {
      readonly content: WalkthroughContent;
      readonly sessionId: string;
      readonly durationMs: number;
      readonly costUsd: number | undefined;
    },
    WalkthroughFailedError
  >;
}
export const WalkthroughWriter = Context.Service<
  '@porcelain/walkthroughs/WalkthroughWriter',
  WalkthroughWriter
>('@porcelain/walkthroughs/WalkthroughWriter');

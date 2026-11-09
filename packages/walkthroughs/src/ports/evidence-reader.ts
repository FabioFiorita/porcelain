import { Context, type Effect } from 'effect';
import type {
  WalkthroughEvidence,
  WalkthroughJob,
} from '../models/walkthrough.ts';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export interface EvidenceReader {
  readonly read: (
    job: WalkthroughJob,
  ) => Effect.Effect<WalkthroughEvidence, WalkthroughFailedError>;
}
export const EvidenceReader = Context.Service<
  '@porcelain/walkthroughs/EvidenceReader',
  EvidenceReader
>('@porcelain/walkthroughs/EvidenceReader');

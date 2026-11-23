import { Context, type Effect } from 'effect';
import type {
  WalkthroughEvidence,
  WalkthroughRun,
} from '../models/walkthrough.ts';
import type { WalkthroughFailedError } from '../errors/walkthrough-failed-error.ts';
export interface EvidenceReader {
  readonly read: (target: {
    projectId: string;
    headOid: string;
    number: number;
    repository: NonNullable<WalkthroughRun['pullRequestRepository']>;
  }) => Effect.Effect<WalkthroughEvidence, WalkthroughFailedError>;
}
export const EvidenceReader = Context.Service<
  '@porcelain/walkthroughs/EvidenceReader',
  EvidenceReader
>('@porcelain/walkthroughs/EvidenceReader');

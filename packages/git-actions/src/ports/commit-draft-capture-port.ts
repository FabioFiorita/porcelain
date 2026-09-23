import type {
  CommitDraftObservation,
  CommitDraftUntrackedContent,
} from '../models/commit-draft-change.ts';
import type { GitActionScope } from '../models/git-action.ts';

export interface CommitDraftCaptureReaderPort {
  readChanges(): Promise<CommitDraftObservation>;
  readSelectedDiff(
    headOid: string | null,
    paths: readonly string[],
  ): Promise<string | undefined>;
  readUntracked(path: string): Promise<CommitDraftUntrackedContent>;
  confirm(): Promise<void>;
}

export interface CommitDraftCapturePort {
  open(
    scope: GitActionScope,
    signal: AbortSignal,
  ): CommitDraftCaptureReaderPort;
}

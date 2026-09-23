import type {
  CommitDraftObservation,
  CommitDraftUntrackedContent,
} from '../models/commit-draft-change.ts';

export interface CommitDraftSnapshotReader {
  changes(): Promise<CommitDraftObservation>;
  selectedDiff(
    headOid: string | undefined,
    paths: readonly string[],
  ): Promise<string | undefined>;
  untracked(path: string): Promise<CommitDraftUntrackedContent>;
  confirm(): Promise<void>;
}

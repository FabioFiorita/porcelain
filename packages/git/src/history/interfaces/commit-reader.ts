import type {
  BranchBases,
  BranchDiffs,
  BranchDiffsRequest,
  BranchRange,
  BranchRangeRequest,
} from '../dtos/branch-range.ts';
import type {
  CommitDiffsRequest,
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPageRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import type { GitDiffResult } from '../../inspection/index.ts';

export interface CommitReader {
  listCommits(
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage>;
  readCommitFiles(
    request: CommitFilesRequest,
    signal?: AbortSignal,
  ): Promise<CommitFiles>;
  readCommitDiffs(
    request: CommitDiffsRequest,
    signal?: AbortSignal,
  ): Promise<Map<string, GitDiffResult> | null>;
  readBranchRange(
    request: BranchRangeRequest,
    signal?: AbortSignal,
  ): Promise<BranchRange>;
  readBranchDiffs(
    request: BranchDiffsRequest,
    signal?: AbortSignal,
  ): Promise<BranchDiffs>;
  listBranchBases(signal?: AbortSignal): Promise<BranchBases>;
}
export interface CommitReaderFactory {
  (checkout: HistoryCheckout): CommitReader;
}

import type {
  CommitDiffsRequest,
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPageRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';
import type { GitDiffResult } from '../../inspection/dtos/git-diff.ts';

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
}
export type CommitReaderFactory = (checkout: HistoryCheckout) => CommitReader;

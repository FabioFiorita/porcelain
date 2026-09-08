import type {
  CommitChanges,
  CommitChangesRequest,
  CommitPage,
  CommitPageRequest,
  HistoryCheckout,
} from '../dtos/commit-history.ts';

export interface CommitReader {
  listCommits(
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage>;
  inspectCommitChanges(
    request: CommitChangesRequest,
    signal?: AbortSignal,
  ): Promise<CommitChanges>;
}
export type CommitReaderFactory = (checkout: HistoryCheckout) => CommitReader;

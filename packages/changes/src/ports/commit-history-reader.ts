import type {
  CommitFiles,
  CommitFilesRequest,
  CommitPage,
  CommitPageRequest,
  CommitPatches,
  CommitPatchesRequest,
} from '../models/commit-history.ts';

export interface CommitHistoryReader {
  listCommits(
    worktreeId: string,
    request: CommitPageRequest,
    signal?: AbortSignal,
  ): Promise<CommitPage>;
  readCommitFiles(
    worktreeId: string,
    request: CommitFilesRequest,
    signal?: AbortSignal,
  ): Promise<CommitFiles | undefined>;
  readCommitPatches(
    worktreeId: string,
    request: CommitPatchesRequest,
    signal?: AbortSignal,
  ): Promise<CommitPatches>;
}

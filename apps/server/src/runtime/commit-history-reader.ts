import type {
  ListCommitsResponse,
  ReadCommitDiffsResponse,
  ReadCommitFilesResponse,
} from '@porcelain/contracts/changes';

export type CommitPageInput = {
  limit?: number | undefined;
  after?: string[] | undefined;
  tip?: string | undefined;
};

export type CommitFilesInput = {
  oid: string;
  parent?: number | undefined;
};

export type CommitDiffsInput = CommitFilesInput & { paths: string[] };

export interface CommitHistoryReader {
  listCommits(
    worktreeId: string,
    request: CommitPageInput,
    signal?: AbortSignal,
  ): Promise<ListCommitsResponse>;
  readCommitFiles(
    worktreeId: string,
    request: CommitFilesInput,
    signal?: AbortSignal,
  ): Promise<ReadCommitFilesResponse>;
  readCommitDiffs(
    worktreeId: string,
    request: CommitDiffsInput,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<
    string,
    ReadCommitDiffsResponse['diffs'][number]['content']
  > | null>;
}

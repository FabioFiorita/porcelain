import type {
  CommitDiffsResponse,
  CommitFilesResponse,
  CommitPageResponse,
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
  ): Promise<CommitPageResponse>;
  readCommitFiles(
    worktreeId: string,
    request: CommitFilesInput,
    signal?: AbortSignal,
  ): Promise<CommitFilesResponse>;
  readCommitDiffs(
    worktreeId: string,
    request: CommitDiffsInput,
    signal?: AbortSignal,
  ): Promise<ReadonlyMap<
    string,
    CommitDiffsResponse['diffs'][number]['content']
  > | null>;
}

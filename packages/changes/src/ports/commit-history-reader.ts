import type {
  CommitFilesLookup,
  CommitPage,
  CommitPatches,
  CommitPatchesRequest,
} from '../models/commit-history.ts';
import type { ListCommitsInput } from '../models/list-commits.ts';
import type { ReadCommitFilesInput } from '../models/read-commit-files.ts';

export interface CommitHistoryReader {
  listCommits(
    input: ListCommitsInput,
    signal?: AbortSignal,
  ): Promise<CommitPage>;
  readCommitFiles(
    input: ReadCommitFilesInput,
    signal?: AbortSignal,
  ): Promise<CommitFilesLookup>;
  readCommitPatches(
    input: CommitPatchesRequest,
    signal?: AbortSignal,
  ): Promise<CommitPatches>;
}

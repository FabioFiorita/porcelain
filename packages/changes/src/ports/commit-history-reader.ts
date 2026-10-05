import type { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type {
  CommitFilesLookup,
  CommitPage,
  CommitPatches,
  CommitPatchesRequest,
} from '../models/commit-history.ts';
import type { ListCommitsInput } from '../models/list-commits.ts';
import type {
  FileCommits,
  ListFileCommitsInput,
} from '../models/list-file-commits.ts';
import type { ReadCommitFilesInput } from '../models/read-commit-files.ts';

export interface CommitHistoryReader<E = never> {
  listCommits(
    input: ListCommitsInput,
  ): Effect.Effect<CommitPage, E, WorktreeRead>;
  listFileCommits(
    input: ListFileCommitsInput,
  ): Effect.Effect<FileCommits, E, WorktreeRead>;
  readCommitFiles(
    input: ReadCommitFilesInput,
  ): Effect.Effect<CommitFilesLookup, E, WorktreeRead>;
  readCommitPatches(
    input: CommitPatchesRequest,
  ): Effect.Effect<CommitPatches, E, WorktreeRead>;
}

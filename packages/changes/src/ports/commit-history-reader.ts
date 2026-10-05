import { type GitIoFailure } from '@porcelain/git/errors';
import { type Effect, Context } from 'effect';
import { type WorktreeRead } from '@porcelain/effects/worktree';
import {
  type CommitFilesLookup,
  type CommitPage,
  type CommitPatches,
  type CommitPatchesRequest,
} from '../models/commit-history.ts';
import { type ListCommitsInput } from '../models/list-commits.ts';
import {
  type FileCommits,
  type ListFileCommitsInput,
} from '../models/list-file-commits.ts';
import { type ReadCommitFilesInput } from '../models/read-commit-files.ts';

export interface CommitHistoryReader {
  listCommits(
    input: ListCommitsInput,
  ): Effect.Effect<CommitPage, GitIoFailure, WorktreeRead>;
  listFileCommits(
    input: ListFileCommitsInput,
  ): Effect.Effect<FileCommits, GitIoFailure, WorktreeRead>;
  readCommitFiles(
    input: ReadCommitFilesInput,
  ): Effect.Effect<CommitFilesLookup, GitIoFailure, WorktreeRead>;
  readCommitPatches(
    input: CommitPatchesRequest,
  ): Effect.Effect<CommitPatches, GitIoFailure, WorktreeRead>;
}

export const CommitHistoryReader = Context.Service<
  '@porcelain/changes/CommitHistoryReader',
  CommitHistoryReader
>('@porcelain/changes/CommitHistoryReader');

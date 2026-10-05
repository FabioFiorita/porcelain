import type { GitIoFailure } from '../ports/git-io-failure.ts';
import { Effect } from 'effect';
import {
  nativeRead,
  nativeWrite,
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects/worktree';
import { isRepositoryUnavailable } from '@porcelain/git/errors';
import {
  HistorySnapshotUnavailableError,
  HistoryWorktreeUnavailableError,
  InvalidHistoryRequestError,
  ReadLimitExceededError,
  UnsupportedHistoryDataError,
} from '@porcelain/git/errors';
import {
  GitTimeoutError,
  InspectionLimitError,
  InvalidGitDiffError,
  InvalidGitStatusError,
  UnsupportedGitFiltersError,
  UnsupportedPathEncodingError,
} from '@porcelain/git/errors';
import { WorktreeNotFoundError } from '@porcelain/kernel/errors';
import { RepositoryUnavailableError } from '@porcelain/projects/errors';

function expectedFailure(
  error: unknown,
): error is Exclude<GitIoFailure, RepositoryUnavailableError> {
  return (
    error instanceof HistorySnapshotUnavailableError ||
    error instanceof HistoryWorktreeUnavailableError ||
    error instanceof InvalidHistoryRequestError ||
    error instanceof ReadLimitExceededError ||
    error instanceof UnsupportedHistoryDataError ||
    error instanceof GitTimeoutError ||
    error instanceof InspectionLimitError ||
    error instanceof InvalidGitDiffError ||
    error instanceof InvalidGitStatusError ||
    error instanceof UnsupportedGitFiltersError ||
    error instanceof UnsupportedPathEncodingError ||
    error instanceof WorktreeNotFoundError
  );
}

function failedGit(error: unknown): Effect.Effect<never, GitIoFailure> {
  if (expectedFailure(error)) return Effect.fail(error);
  if (isRepositoryUnavailable(error))
    return Effect.fail(new RepositoryUnavailableError());
  return Effect.die(error);
}

export function readGit<A>(
  worktreeId: string,
  work: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A, GitIoFailure, WorktreeRead> {
  return Effect.catchDefect(nativeRead(worktreeId, work), failedGit);
}

export function writeGit<A>(
  worktreeId: string,
  work: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A, GitIoFailure, WorktreeWrite> {
  return Effect.catchDefect(nativeWrite(worktreeId, work), failedGit);
}

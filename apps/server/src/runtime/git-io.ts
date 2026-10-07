import { nativeOperation } from '@porcelain/effects';
import {
  type GitIoFailure,
  isRepositoryUnavailable,
  HistorySnapshotUnavailableError,
  HistoryWorktreeUnavailableError,
  InvalidHistoryRequestError,
  ReadLimitExceededError,
  UnsupportedHistoryDataError,
  GitTimeoutError,
  InspectionLimitError,
  InvalidGitDiffError,
  InvalidGitStatusError,
  UnsupportedGitFiltersError,
  UnsupportedPathEncodingError,
} from '@porcelain/git/errors';
import { Effect } from 'effect';
import {
  admittedRead,
  nativeWrite,
  type WorktreeRead,
  type WorktreeWrite,
} from '@porcelain/effects/worktree';
import {
  WorktreeNotFoundError,
  RepositoryUnavailableError,
} from '@porcelain/kernel/errors';

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

export function readGitEffect<A, E, R>(
  worktreeId: string,
  work: Effect.Effect<A, E, R>,
): Effect.Effect<A, GitIoFailure, R | WorktreeRead> {
  return admittedRead(
    worktreeId,
    work.pipe(Effect.catch(failedGit), Effect.catchDefect(failedGit)),
  );
}

export function readGit<A>(
  worktreeId: string,
  work: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A, GitIoFailure, WorktreeRead> {
  return readGitEffect(worktreeId, nativeOperation(work));
}

export function writeGit<A>(
  worktreeId: string,
  work: (signal: AbortSignal) => Promise<A>,
): Effect.Effect<A, GitIoFailure, WorktreeWrite> {
  return Effect.catchDefect(nativeWrite(worktreeId, work), failedGit);
}

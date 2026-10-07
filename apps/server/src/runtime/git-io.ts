import { Effect, type PlatformError } from 'effect';
import {
  type GitIoFailure,
  type GitCommandError,
  type GitOutputLimitError,
  type GitFilesystemError,
  type RepositoryIdentityMismatchError,
  type UnsupportedFilesystemIdentityError,
  type UnsupportedRepositoryError,
  isRepositoryUnavailable,
} from '@porcelain/git/errors';
import { admittedRead, type WorktreeRead } from '@porcelain/effects/worktree';
import { RepositoryUnavailableError } from '@porcelain/kernel/errors';

type GitPlatformFailure =
  | GitCommandError
  | GitOutputLimitError
  | GitFilesystemError
  | RepositoryIdentityMismatchError
  | UnsupportedFilesystemIdentityError
  | UnsupportedRepositoryError
  | PlatformError.PlatformError;

function failedGit(
  error: GitPlatformFailure,
): Effect.Effect<never, RepositoryUnavailableError> {
  return isRepositoryUnavailable(error)
    ? Effect.fail(new RepositoryUnavailableError())
    : Effect.die(error);
}

export function readGitEffect<A, R>(
  worktreeId: string,
  work: Effect.Effect<A, GitIoFailure | GitPlatformFailure, R>,
): Effect.Effect<A, GitIoFailure, R | WorktreeRead> {
  return admittedRead(
    worktreeId,
    work.pipe(
      Effect.catchTag(
        [
          'GitCommandError',
          'GitOutputLimitError',
          'GitFilesystemError',
          'RepositoryIdentityMismatchError',
          'UnsupportedFilesystemIdentityError',
          'UnsupportedRepositoryError',
          'PlatformError',
        ],
        failedGit,
      ),
    ),
  );
}

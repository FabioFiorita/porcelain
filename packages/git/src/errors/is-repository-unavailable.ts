import { GitCommandError } from './git-command-error.ts';
import { RepositoryIdentityMismatchError } from './repository-identity-mismatch-error.ts';
import { UnsupportedFilesystemIdentityError } from './unsupported-filesystem-identity-error.ts';
import { UnsupportedRepositoryError } from './unsupported-repository-error.ts';

export function isRepositoryUnavailable(error: unknown): boolean {
  if (
    error instanceof UnsupportedRepositoryError ||
    error instanceof RepositoryIdentityMismatchError ||
    error instanceof UnsupportedFilesystemIdentityError
  )
    return true;
  if (error instanceof GitCommandError) {
    // Numeric exit codes mean Git ran but could not inspect this repository.
    // Missing executables, timeouts and cancellation are environment/operation failures.
    const cause = error.cause;
    return (
      cause instanceof Error &&
      'code' in cause &&
      typeof cause.code === 'number'
    );
  }
  return (
    error instanceof Error &&
    'code' in error &&
    ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(String(error.code))
  );
}

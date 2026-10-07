import { isMissing } from './is-missing.ts';
import { GitCommandError } from './git-command-error.ts';
import { GitFilesystemError } from './git-filesystem-error.ts';
import { UnsupportedFilesystemIdentityError } from './unsupported-filesystem-identity-error.ts';
import { RepositoryIdentityMismatchError } from './repository-identity-mismatch-error.ts';
import { UnsupportedRepositoryError } from './unsupported-repository-error.ts';

export function isRepositoryUnavailable(error: unknown): boolean {
  if (
    error instanceof UnsupportedRepositoryError ||
    error instanceof RepositoryIdentityMismatchError ||
    error instanceof UnsupportedFilesystemIdentityError
  )
    return true;
  if (error instanceof GitCommandError) return error.exitCode !== undefined;
  if (error instanceof GitFilesystemError)
    return isRepositoryUnavailable(error.cause);
  return (
    isMissing(error) ||
    (error instanceof Error &&
      'code' in error &&
      (error.code === 'EACCES' || error.code === 'EPERM'))
  );
}

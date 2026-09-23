import { GitCommandError } from '../../shared/errors/git-command-error.ts';
import { UnsupportedFilesystemIdentityError } from '../../shared/errors/unsupported-filesystem-identity-error.ts';
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
  return (
    error instanceof Error &&
    'code' in error &&
    ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(String(error.code))
  );
}

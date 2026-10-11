import { PlatformError } from 'effect';
import { GitCommandError } from './git-command-error.ts';
import { GitFilesystemError } from './git-filesystem-error.ts';
import { isMissing } from './is-missing.ts';
import { UnsupportedFilesystemIdentityError } from './unsupported-filesystem-identity-error.ts';
import { RepositoryIdentityMismatchError } from './repository-identity-mismatch-error.ts';
import { UnsupportedRepositoryError } from './unsupported-repository-error.ts';

export function repositoryUnavailableReason(
  error: unknown,
): 'missing' | 'permission' | 'git-failed' | undefined {
  if (
    error instanceof UnsupportedRepositoryError ||
    error instanceof RepositoryIdentityMismatchError ||
    error instanceof UnsupportedFilesystemIdentityError
  )
    return 'git-failed';
  if (error instanceof GitCommandError) return 'git-failed';
  if (error instanceof GitFilesystemError)
    return repositoryUnavailableReason(error.cause);
  if (isMissing(error)) return 'missing';
  if (PlatformError.isPlatformError(error)) {
    if (error.reason._tag === 'PermissionDenied') return 'permission';
    return repositoryUnavailableReason(error.reason.cause);
  }
  if (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'EACCES' || error.code === 'EPERM')
  )
    return 'permission';
  return undefined;
}

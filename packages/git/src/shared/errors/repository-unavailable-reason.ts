import { PlatformError } from 'effect';
import { GitCommandError } from './git-command-error.ts';
import { GitFilesystemError } from './git-filesystem-error.ts';
import { isMissing } from './is-missing.ts';

export function repositoryUnavailableReason(
  error: unknown,
): 'missing' | 'permission' | 'git-failed' {
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
  return 'git-failed';
}

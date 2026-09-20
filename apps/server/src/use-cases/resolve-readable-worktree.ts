import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import type { ResolvedWorktree } from '../models/worktree.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import type { ResolveWorktree } from './resolve-worktree.ts';

/**
 * A worktree a file may be read from.
 *
 * This used to re-run `git worktree list` on every file read to prove the
 * worktree was still the one the id named. The directory proves the same thing
 * by re-deriving the id from the administrative directory, which costs a
 * `stat` instead of a Git process.
 */
export async function resolveReadableWorktree(
  worktrees: ResolveWorktree,
  id: string,
  signal?: AbortSignal,
): Promise<ResolvedWorktree> {
  try {
    return await worktrees.reachable(id, signal);
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof WorktreeNotFoundError)
      throw new FileInspectionError('WORKTREE_NOT_FOUND', { cause: error });
    if (error instanceof RepositoryIdentityMismatchError)
      throw new FileInspectionError('REPOSITORY_UNAVAILABLE', {
        cause: error,
      });
    throw error;
  }
}

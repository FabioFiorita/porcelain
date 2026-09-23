import { FileInspectionError } from '@porcelain/files/errors';
import type { ReachableWorktreeReader } from '@porcelain/files/ports';
import { RepositoryIdentityMismatchError } from '@porcelain/git/discovery';
import { WorktreeNotFoundError } from '@porcelain/projects/errors';

type WorktreeReader = {
  reachable(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<{ path: string; metadataIdentity: string }>;
};

export function createReadableWorktrees(
  worktrees: WorktreeReader,
): ReachableWorktreeReader {
  return {
    reachable: async (worktreeId, signal) => {
      try {
        return await worktrees.reachable(worktreeId, signal);
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
    },
  };
}

import { FileInspectionError } from '../filesystem/errors/file-inspection-error.ts';
import { isRepositoryUnavailable } from '../git/errors/is-repository-unavailable.ts';
import type { GitFactory } from '../git/interfaces/git-factory.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';

export async function resolveReadableWorktree(
  store: InventoryStore,
  git: GitFactory,
  id: string,
  signal?: AbortSignal,
) {
  const project = store
    .read()
    .projects.find((candidate) =>
      candidate.worktrees.some((worktree) => worktree.id === id),
    );
  const worktree = project?.worktrees.find((candidate) => candidate.id === id);
  if (!project || !worktree)
    throw new FileInspectionError('WORKTREE_NOT_FOUND');
  if (!project.available || !worktree.available || !worktree.metadataIdentity)
    throw new FileInspectionError('REPOSITORY_UNAVAILABLE');
  try {
    const { repository } = await git(worktree.path).listWorktrees(signal);
    const current = repository.worktrees.find(
      (candidate) => candidate.path === worktree.path,
    );
    if (
      repository.repositoryIdentity !== project.repositoryIdentity ||
      !current?.available ||
      current.metadataIdentity !== worktree.metadataIdentity
    )
      throw new FileInspectionError('REPOSITORY_UNAVAILABLE');
    return worktree;
  } catch (error) {
    signal?.throwIfAborted();
    if (isRepositoryUnavailable(error))
      throw new FileInspectionError('REPOSITORY_UNAVAILABLE', { cause: error });
    throw error;
  }
}

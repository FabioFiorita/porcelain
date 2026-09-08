import { RepositoryIdentityMismatchError } from '../git/errors/repository-identity-mismatch-error.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

export function resolveInspectionWorktree(
  store: InventoryStore,
  worktreeId: string,
) {
  const inventory = store.read();
  const project = inventory.projects.find((entry) =>
    entry.worktrees.some((worktree) => worktree.id === worktreeId),
  );
  const worktree = project?.worktrees.find((entry) => entry.id === worktreeId);
  if (!worktree) throw new WorktreeNotFoundError();
  if (!project?.available || !worktree.available || !worktree.metadataIdentity)
    throw new RepositoryIdentityMismatchError();
  return {
    environmentId: inventory.environmentId,
    worktree,
    metadataIdentity: worktree.metadataIdentity,
    repositoryIdentity: project.repositoryIdentity,
  };
}

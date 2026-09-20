import { RepositoryIdentityMismatchError } from '@porcelain/git/errors/repository-identity-mismatch-error';
import type { GitSession } from '@porcelain/git/interfaces/git-session';
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

/** The request's guarded state for one worktree's checkout. */
export function resolveCheckoutSession(
  store: InventoryStore,
  session: GitSession,
  worktreeId: string,
) {
  const resolved = resolveInspectionWorktree(store, worktreeId);
  return {
    ...resolved,
    checkout: session.checkout(
      resolved.worktree.path,
      resolved.metadataIdentity,
      resolved.repositoryIdentity,
    ),
  };
}

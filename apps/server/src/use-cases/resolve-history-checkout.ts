import type { HistoryCheckout } from '../git/dtos/commit-history.ts';
import { HistoryWorktreeUnavailableError } from '../git/errors/history-worktree-unavailable-error.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

export function resolveHistoryCheckout(
  store: InventoryStore,
  worktreeId: string,
): HistoryCheckout {
  const inventory = store.read();
  const project = inventory.projects.find((entry) =>
    entry.worktrees.some((worktree) => worktree.id === worktreeId),
  );
  const worktree = project?.worktrees.find((entry) => entry.id === worktreeId);
  if (!worktree) throw new WorktreeNotFoundError();
  if (!project?.available || !worktree?.available || !worktree.metadataIdentity)
    throw new HistoryWorktreeUnavailableError();
  return {
    path: worktree.path,
    repositoryIdentity: project.repositoryIdentity,
    metadataIdentity: worktree.metadataIdentity,
    scope: `${inventory.environmentId}:${project.id}:${worktree.id}`,
  };
}

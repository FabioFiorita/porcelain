import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';

export function assertArtifactScope(
  inventory: Pick<InventoryStore, 'read'>,
  worktreeId: string,
) {
  if (
    !inventory
      .read()
      .projects.some((project) =>
        project.worktrees.some((worktree) => worktree.id === worktreeId),
      )
  )
    throw new WorktreeNotFoundError();
}

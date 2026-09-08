import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { ArtifactNotFoundError } from './errors/artifact-not-found-error.ts';

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
    throw new ArtifactNotFoundError();
}

import type { CommitReviewLayerStore } from '../repositories/interfaces/commit-review-layer-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';

export class GetCommitReviewLayers {
  private readonly inventory: InventoryStore;
  private readonly snapshots: CommitReviewLayerStore;
  constructor(inventory: InventoryStore, snapshots: CommitReviewLayerStore) {
    this.inventory = inventory;
    this.snapshots = snapshots;
  }
  execute(projectId: string, commitOid: string) {
    if (
      !this.inventory
        .read()
        .projects.some((project) => project.id === projectId)
    )
      throw new ProjectNotFoundError();
    return this.snapshots.read(projectId, commitOid);
  }
}

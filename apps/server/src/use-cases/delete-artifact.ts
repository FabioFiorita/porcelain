import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';

export class DeleteArtifact {
  private readonly store: Pick<ArtifactStore, 'delete'>;
  private readonly inventory: Pick<InventoryStore, 'read'>;
  constructor(
    store: Pick<ArtifactStore, 'delete'>,
    inventory: Pick<InventoryStore, 'read'>,
  ) {
    this.store = store;
    this.inventory = inventory;
  }
  execute(worktreeId: string, artifactId: string) {
    assertArtifactScope(this.inventory, worktreeId);
    return { deleted: this.store.delete(worktreeId, artifactId) };
  }
}

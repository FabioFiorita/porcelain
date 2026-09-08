import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';

export class ListArtifacts {
  private readonly store: Pick<ArtifactStore, 'list'>;
  private readonly inventory: Pick<InventoryStore, 'read'>;
  constructor(
    store: Pick<ArtifactStore, 'list'>,
    inventory: Pick<InventoryStore, 'read'>,
  ) {
    this.store = store;
    this.inventory = inventory;
  }
  execute(worktreeId: string) {
    assertArtifactScope(this.inventory, worktreeId);
    return this.store.list(worktreeId);
  }
}

import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';
import { ArtifactNotFoundError } from './errors/artifact-not-found-error.ts';

export class GetArtifact {
  private readonly store: Pick<ArtifactStore, 'get'>;
  private readonly inventory: Pick<InventoryStore, 'read'>;
  constructor(
    store: Pick<ArtifactStore, 'get'>,
    inventory: Pick<InventoryStore, 'read'>,
  ) {
    this.store = store;
    this.inventory = inventory;
  }
  execute(worktreeId: string, artifactId: string) {
    assertArtifactScope(this.inventory, worktreeId);
    const artifact = this.store.get(worktreeId, artifactId);
    if (!artifact) throw new ArtifactNotFoundError();
    return artifact;
  }
}

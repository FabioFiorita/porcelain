import { type ArtifactUpload, artifactLimits } from '../models/artifact.ts';
import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { assertArtifactScope } from './assert-artifact-scope.ts';
import { InvalidArtifactError } from './errors/invalid-artifact-error.ts';

export class UploadArtifact {
  private readonly store: Pick<ArtifactStore, 'create'>;
  private readonly inventory: Pick<InventoryStore, 'read'>;
  constructor(
    store: Pick<ArtifactStore, 'create'>,
    inventory: Pick<InventoryStore, 'read'>,
  ) {
    this.store = store;
    this.inventory = inventory;
  }
  execute(worktreeId: string, input: ArtifactUpload) {
    assertArtifactScope(this.inventory, worktreeId);
    if (
      !input.content.isWellFormed() ||
      !input.name.isWellFormed() ||
      input.name.length < 1 ||
      input.name.length > 256
    )
      throw new InvalidArtifactError();
    const sizeBytes = new TextEncoder().encode(input.content).byteLength;
    if (sizeBytes < 1 || sizeBytes > artifactLimits.contentBytes)
      throw new InvalidArtifactError();
    return this.store.create(worktreeId, input, sizeBytes);
  }
}

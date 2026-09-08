import type { InspectionFactory } from '@porcelain/git/interfaces/inspection-factory';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { resolveInspectionWorktree } from './resolve-inspection-worktree.ts';

export class ReadWorktreeStatus {
  private readonly store: InventoryStore;
  private readonly git: InspectionFactory;

  constructor(store: InventoryStore, git: InspectionFactory) {
    this.store = store;
    this.git = git;
  }

  async execute(worktreeId: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const { environmentId, worktree, metadataIdentity, repositoryIdentity } =
      resolveInspectionWorktree(this.store, worktreeId);
    const status = await this.git(
      worktree.path,
      metadataIdentity,
      repositoryIdentity,
    ).readStatus(signal);
    signal?.throwIfAborted();
    return { environmentId, worktreeId, status };
  }
}

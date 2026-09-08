import type { FilePreferenceStore } from '../repositories/interfaces/file-preference-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
export class ListFilePreferences {
  private readonly inventory: InventoryStore;
  private readonly preferences: FilePreferenceStore;
  constructor(inventory: InventoryStore, preferences: FilePreferenceStore) {
    this.inventory = inventory;
    this.preferences = preferences;
  }
  execute(worktreeId: string) {
    if (
      !this.inventory
        .read()
        .projects.some((project) =>
          project.worktrees.some((worktree) => worktree.id === worktreeId),
        )
    )
      throw new WorktreeNotFoundError();
    return this.preferences.list(worktreeId);
  }
}

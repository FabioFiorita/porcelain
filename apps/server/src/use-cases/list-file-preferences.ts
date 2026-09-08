import type { FilePreferenceStore } from '../repositories/interfaces/file-preference-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { UnknownWorktreeError } from './errors/unknown-worktree-error.ts';
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
      throw new UnknownWorktreeError();
    return this.preferences.list(worktreeId);
  }
}

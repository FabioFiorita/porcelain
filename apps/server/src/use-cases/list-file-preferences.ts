import type { FilePreferenceStore } from '../repositories/interfaces/file-preference-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';
export class ListFilePreferences {
  private readonly inventory: InventoryStore;
  private readonly preferences: FilePreferenceStore;
  constructor(inventory: InventoryStore, preferences: FilePreferenceStore) {
    this.inventory = inventory;
    this.preferences = preferences;
  }
  execute(projectId: string) {
    if (
      !this.inventory
        .read()
        .projects.some((project) => project.id === projectId)
    )
      throw new ProjectNotFoundError();
    return this.preferences.list(projectId);
  }
}

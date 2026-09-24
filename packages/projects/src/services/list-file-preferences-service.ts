import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type {
  ListFilePreferencesInput,
  ListFilePreferencesResult,
} from '../models/list-file-preferences.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListFilePreferencesService {
  private readonly inventory: InventoryStore;
  private readonly filePreference: FilePreferenceStore;

  constructor(inventory: InventoryStore, filePreference: FilePreferenceStore) {
    this.inventory = inventory;
    this.filePreference = filePreference;
  }

  execute(input: ListFilePreferencesInput): ListFilePreferencesResult {
    const project = this.inventory.find({ projectId: input.projectId });
    if (!project) throw new ProjectNotFoundError();
    return {
      preferences: this.filePreference.list({ projectId: input.projectId }),
    };
  }
}

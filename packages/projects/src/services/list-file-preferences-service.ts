import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type {
  FilePreferenceList,
  ListFilePreferencesInput,
} from '../models/file-preference.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

export class ListFilePreferencesService {
  private readonly inventoryStore: InventoryStore;
  private readonly filePreferenceStore: FilePreferenceStore;

  constructor(
    inventoryStore: InventoryStore,
    filePreferenceStore: FilePreferenceStore,
  ) {
    this.inventoryStore = inventoryStore;
    this.filePreferenceStore = filePreferenceStore;
  }

  execute(input: ListFilePreferencesInput): FilePreferenceList {
    if (
      !this.inventoryStore
        .read()
        .projects.some((project) => project.id === input.projectId)
    )
      throw new ProjectNotFoundError();
    return { preferences: this.filePreferenceStore.list(input.projectId) };
  }
}

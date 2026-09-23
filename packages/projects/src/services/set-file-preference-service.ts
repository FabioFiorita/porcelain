import { FilePreferenceLimitError } from '../errors/file-preference-limit-error.ts';
import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type {
  FilePreference,
  FilePreferenceList,
  SetFilePreferenceInput,
} from '../models/file-preference.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';
import type { InventoryStore } from '../ports/inventory-store.ts';

const PREFERENCE_LIMIT = 2000;

export class SetFilePreferenceService {
  private readonly inventoryStore: InventoryStore;
  private readonly filePreferenceStore: FilePreferenceStore;

  constructor(
    inventoryStore: InventoryStore,
    filePreferenceStore: FilePreferenceStore,
  ) {
    this.inventoryStore = inventoryStore;
    this.filePreferenceStore = filePreferenceStore;
  }

  execute(input: SetFilePreferenceInput): FilePreferenceList {
    if (
      !this.inventoryStore
        .read()
        .projects.some((project) => project.id === input.projectId)
    )
      throw new ProjectNotFoundError();
    const existing = this.filePreferenceStore.find(input.projectId, input.path);
    const next: FilePreference = {
      path: input.path,
      pinned: existing?.pinned ?? false,
      hidden: existing?.hidden ?? false,
      [input.flag]: input.value,
    };
    if (!next.pinned && !next.hidden) {
      if (existing)
        this.filePreferenceStore.remove(input.projectId, input.path);
    } else {
      if (
        !existing &&
        this.filePreferenceStore.count(input.projectId) >= PREFERENCE_LIMIT
      )
        throw new FilePreferenceLimitError();
      this.filePreferenceStore.save(input.projectId, next);
    }
    return { preferences: this.filePreferenceStore.list(input.projectId) };
  }
}

import { ProjectNotFoundError } from '../errors/project-not-found-error.ts';
import type { FilePreference } from '../models/file-preference.ts';
import type { FilePreferenceStore } from '../ports/file-preference-store.ts';
import type { ProjectStore } from '../ports/project-store.ts';

export class ListFilePreferencesService {
  private readonly inventory: ProjectStore;
  private readonly preferences: FilePreferenceStore;
  constructor(inventory: ProjectStore, preferences: FilePreferenceStore) {
    this.inventory = inventory;
    this.preferences = preferences;
  }
  execute(projectId: string): FilePreference[] {
    if (
      !this.inventory
        .read()
        .projects.some((project) => project.id === projectId)
    )
      throw new ProjectNotFoundError();
    return this.preferences.list(projectId);
  }
}

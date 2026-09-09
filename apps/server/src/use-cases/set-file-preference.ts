import type { FilePreferenceChange } from '../models/file-preference.ts';
import type { FilePreferenceStore } from '../repositories/interfaces/file-preference-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { InvalidFilePreferenceError } from './errors/invalid-file-preference-error.ts';
import { ProjectNotFoundError } from './errors/project-not-found-error.ts';

export class SetFilePreference {
  private readonly inventory: InventoryStore;
  private readonly preferences: FilePreferenceStore;
  constructor(inventory: InventoryStore, preferences: FilePreferenceStore) {
    this.inventory = inventory;
    this.preferences = preferences;
  }
  execute(projectId: string, change: FilePreferenceChange) {
    if (
      !change.path ||
      change.path.length > 4096 ||
      change.path.includes('\\') ||
      change.path.includes('\0') ||
      /^[A-Za-z]:/.test(change.path) ||
      !change.path
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            part.toLowerCase() !== '.git',
        ) ||
      !['pinned', 'hidden'].includes(change.flag) ||
      typeof change.value !== 'boolean'
    )
      throw new InvalidFilePreferenceError();
    if (
      !this.inventory
        .read()
        .projects.some((project) => project.id === projectId)
    )
      throw new ProjectNotFoundError();
    this.preferences.set(projectId, change);
    return this.preferences.list(projectId);
  }
}

export { readInventory } from './queries/inventory.ts';
export { InventorySeed } from './store/inventory.ts';
export { ProjectSelectionStore } from './store.ts';
export {
  ProjectSelectionStorage,
  type ProjectSelectionSnapshot,
} from './ports/project-selection-storage.ts';
export {
  registerProject,
  renameProject,
  removeProject,
} from './commands/projects.ts';
export { setFilePreference } from './commands/file-preferences.ts';
export { filePreferencesQueryOptions } from './queries/file-preferences.ts';

export { readProjectFolder } from './queries/folders.ts';
export { projectSelectionSnapshotSchema } from './store/selection-snapshot.ts';

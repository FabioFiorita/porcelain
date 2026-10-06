export {
  inventoryQueryOptions,
  inventoryScopeQueryOptions,
} from './queries/inventory.ts';
export { ProjectSelectionStore } from './store.ts';
export {
  ProjectSelectionStorage,
  type ProjectSelectionSnapshot,
} from './ports/project-selection-storage.ts';
export { projectCommands, setFilePreference } from './commands/projects.ts';
export { filePreferencesQueryOptions } from './queries/file-preferences.ts';

export { readProjectFolder } from './queries/folders.ts';
export { projectSelectionSnapshotSchema } from './store/selection-snapshot.ts';

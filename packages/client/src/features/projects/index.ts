export {
  inventoryQueryOptions,
  inventoryScopeQueryOptions,
} from './queries/inventory.ts';
export {
  createProjectSelectionStore,
  type ProjectSelectionStore,
} from './store.ts';
export type {
  ProjectSelectionStorage,
  ProjectSelectionSnapshot,
} from './ports/project-selection-storage.ts';
export { projectCommands, setFilePreference } from './commands/projects.ts';
export { filePreferencesQueryOptions } from './queries/file-preferences.ts';

export { projectFolderQueryOptions } from './queries/folders.ts';
export { projectSelectionSnapshotSchema } from './store/selection-snapshot.ts';

export { useSetHidden, useSetPinned } from './commands/file-preferences';
export { useNativeProjectPicker } from './commands/open-project';
export { openProjectDialog } from './overlays';
export { useHiddenPaths, usePinnedPaths } from './queries/file-preferences';
export { useInventory } from './queries/inventory';

export type { WorktreeTarget } from './rules/worktree-target';
export { OpenProjectDialog } from './views/open-project-dialog';
export { ProjectNavigator } from './views/project-navigator';
export { RemoveProjectDialog } from './views/remove-project-dialog';
export { RenameProjectDialog } from './views/rename-project-dialog';
export {
  ProjectWorkspace,
  ProjectWorkspaceProvider,
} from './views/project-workspace';

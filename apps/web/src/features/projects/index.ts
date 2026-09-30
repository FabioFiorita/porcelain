export { useSetHidden, useSetPinned } from './commands/file-preferences';
export { openProjectDialog } from './overlays';
export { useHiddenPaths, usePinnedPaths } from './queries/file-preferences';
export { useInventory } from './queries/inventory';
export {
  canonicalPreferencePath,
  hiddenPathFor,
  visibleFileTreePaths,
} from './rules/file-preferences';
export {
  firstWaitingWorktree,
  selectedWorktreeInProject,
  worktreeLabel,
  type Inventory,
  type Project,
  type WorktreeTarget,
} from './rules/inventory';
export { OpenProjectDialog } from './views/open-project-dialog';
export { ProjectNavigator } from './views/project-navigator';
export {
  ProjectWorkspace,
  ProjectWorkspaceProvider,
} from './views/project-workspace';

export { useSetHidden } from './commands/set-hidden';
export { openProjectDialog } from './overlays';
export { useHiddenPaths } from './queries/file-preferences';
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
  type Project,
} from './rules/inventory';
export { OpenProjectDialog } from './views/open-project-dialog';
export { ProjectNavigator } from './views/project-navigator';

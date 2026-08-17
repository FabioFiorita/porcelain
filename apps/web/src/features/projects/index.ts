/** Web Projects data boundary for the shell's switcher and directory picker. */

export type { ProjectSummary } from '@porcelain/client-runtime/projects'
export { CanvasList } from './canvas-list'
export { CanvasView } from './canvas-view'
export { HubTree } from './hub-tree'
export {
  isProjectsQueryKey,
  projectsQueryKey,
  useCanvas,
  useCanvasList,
  useHubInventories,
  useHubInventory,
  useMintCanvasAccessToken,
  useOpenProject,
  useProjectDirectories,
  useRecentProjects,
  useRemoveRecentProject,
  useSelectedProject,
} from './project-data'
export {
  browseProjectDirectoriesOnDaemon,
  openProjectOnDaemon,
  recentProjectsOnDaemon,
  removeRecentProjectOnDaemon,
} from './project-transport'

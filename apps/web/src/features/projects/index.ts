/** Web Projects data boundary for the shell's switcher and directory picker. */

export type { ProjectSummary } from '@porcelain/client-runtime/projects'
export { CanvasList } from './canvas-list'
export { CanvasView } from './canvas-view'
export { HubHomeSummary, HubProjectSummary } from './hub-summaries'
export { HubTree } from './hub-tree'
export {
  isProjectsQueryKey,
  type ProjectsDaemonScope,
  projectsQueryKey,
  useCanvas,
  useCanvasList,
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

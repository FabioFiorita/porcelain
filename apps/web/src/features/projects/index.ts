/** Web Projects data boundary for the shell's switcher and directory picker. */

export type { ProjectSummary } from '@porcelain/client-runtime/projects'
export { HubTree } from './hub-tree'
export {
  isProjectsQueryKey,
  type ProjectsDaemonScope,
  projectsQueryKey,
  useHubInventory,
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

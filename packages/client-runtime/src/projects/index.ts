/** Shared Projects client semantics: typed identities and non-optimistic mutation effects. */

import type { ProjectSummary } from './project-queries'

export {
  groupEquivalentProjects,
  type HubInventorySource,
  type HubProjectGroup,
  type HubProjectMember,
  visibleHubInventories,
} from './hub-grouping'
export {
  type HubSelection,
  type HubTarget,
  hubTabKey,
  hubTargetOf,
  sameHubTarget,
} from './hub-target'
export {
  createHubWorktree,
  openProject,
  type ProjectMutationDefinition,
  type ProjectSelectionEffect,
  removeRecentProject,
} from './project-mutations'
export {
  type HubInventoryQuery,
  hubInventoryQuery,
  type ProjectDirectoriesQuery,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  type RecentProjectsQuery,
  recentProjectsQuery,
} from './project-queries'

export type ProjectPath = ProjectSummary['path']

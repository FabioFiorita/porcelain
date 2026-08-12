/** Shared Projects client semantics: typed identities and non-optimistic mutation effects. */

import type { ProjectSummary } from './project-queries'

export {
  openProject,
  type ProjectMutationDefinition,
  type ProjectSelectionEffect,
  removeRecentProject,
} from './project-mutations'
export {
  type ProjectDirectoriesQuery,
  type ProjectSummary,
  type ProjectsQuery,
  projectDirectoriesQuery,
  projectsQuerySchema,
  type RecentProjectsQuery,
  recentProjectsQuery,
} from './project-queries'

export type ProjectPath = ProjectSummary['path']

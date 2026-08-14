import {
  type CreateHubWorktreeInput,
  type OpenRepoPathInput,
  projectsProcedures,
  type RemoveRecentRepoInput,
} from '@porcelain/contracts/projects'
import { hubInventoryQuery, type ProjectsQuery, recentProjectsQuery } from './project-queries'

export type ProjectSelectionEffect = 'select-result' | 'clear-if-selected-input'

export type ProjectMutationDefinition<
  TName extends 'openRepoPath' | 'removeRecentRepo' | 'createHubWorktree',
  TInput,
  TSelectionEffect extends ProjectSelectionEffect,
> = {
  readonly procedure: (typeof projectsProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly ProjectsQuery[]
  readonly optimistic: false
  readonly requiresAuthoritativeRefetch: true
  readonly selectionEffect: TSelectionEffect
}

function recentProjectQueries(): readonly ProjectsQuery[] {
  return [recentProjectsQuery(false), recentProjectsQuery(true), hubInventoryQuery()]
}

/** Open is authoritative: the daemon's returned summary becomes the selected Project. */
export const openProject = {
  procedure: projectsProcedures.openRepoPath,
  procedureName: 'openRepoPath',
  affectedQueries: (_input: OpenRepoPathInput): readonly ProjectsQuery[] => recentProjectQueries(),
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'select-result',
} as const satisfies ProjectMutationDefinition<'openRepoPath', OpenRepoPathInput, 'select-result'>

/** Remove refreshes both recent result sets and conditionally clears the selected Project. */
export const removeRecentProject = {
  procedure: projectsProcedures.removeRecentRepo,
  procedureName: 'removeRecentRepo',
  affectedQueries: (_input: RemoveRecentRepoInput): readonly ProjectsQuery[] =>
    recentProjectQueries(),
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'clear-if-selected-input',
} as const satisfies ProjectMutationDefinition<
  'removeRecentRepo',
  RemoveRecentRepoInput,
  'clear-if-selected-input'
>

/** Creating a Worktree refreshes the Hub inventory and recent lists. */
export const createHubWorktree = {
  procedure: projectsProcedures.createHubWorktree,
  procedureName: 'createHubWorktree',
  affectedQueries: (_input: CreateHubWorktreeInput): readonly ProjectsQuery[] =>
    recentProjectQueries(),
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'select-result',
} as const satisfies ProjectMutationDefinition<
  'createHubWorktree',
  CreateHubWorktreeInput,
  'select-result'
>

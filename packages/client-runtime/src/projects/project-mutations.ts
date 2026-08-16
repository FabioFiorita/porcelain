import {
  type CreateHubWorktreeInput,
  type OpenRepoPathInput,
  type PromoteCanvasInput,
  type PromoteOverridesInput,
  projectsProcedures,
  type RemoveHubProjectInput,
  type RemoveHubWorktreeInput,
  type RemoveRecentRepoInput,
} from '@porcelain/contracts/projects'
import {
  hubInventoryQuery,
  listCanvasesQuery,
  overlayQuery,
  type ProjectsQuery,
  readCanvasQuery,
  recentProjectsQuery,
} from './project-queries'

export type ProjectSelectionEffect = 'select-result' | 'clear-if-selected-input' | 'none'

export type ProjectMutationDefinition<
  TName extends
    | 'openRepoPath'
    | 'removeRecentRepo'
    | 'removeHubProject'
    | 'removeHubWorktree'
    | 'createHubWorktree'
    | 'promoteCanvas'
    | 'promoteOverrides',
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

/** Remove a Hub Project from this daemon without touching its repository files. */
export const removeHubProject = {
  procedure: projectsProcedures.removeHubProject,
  procedureName: 'removeHubProject',
  affectedQueries: (_input: RemoveHubProjectInput): readonly ProjectsQuery[] =>
    recentProjectQueries(),
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'none',
} as const satisfies ProjectMutationDefinition<'removeHubProject', RemoveHubProjectInput, 'none'>

/**
 * Removing a Worktree runs `git worktree remove` on the daemon: the checkout leaves the
 * disk, so the selection may be pointing at a directory that no longer exists. Callers
 * clear it themselves — the effect is 'none' here because the input names a Worktree and
 * `clear-if-selected-input` compares Project ids.
 */
export const removeHubWorktree = {
  procedure: projectsProcedures.removeHubWorktree,
  procedureName: 'removeHubWorktree',
  affectedQueries: (_input: RemoveHubWorktreeInput): readonly ProjectsQuery[] =>
    recentProjectQueries(),
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'none',
} as const satisfies ProjectMutationDefinition<'removeHubWorktree', RemoveHubWorktreeInput, 'none'>

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

/**
 * Promotion rewrites what the addressed checkout resolves for this Canvas —
 * tracked wins over the private record on the same id — so both the targeted
 * list and the untargeted private list go stale, along with the Canvas itself
 * and that checkout's overlay listing.
 */
export const promoteCanvas = {
  procedure: projectsProcedures.promoteCanvas,
  procedureName: 'promoteCanvas',
  affectedQueries: (input: PromoteCanvasInput): readonly ProjectsQuery[] => [
    listCanvasesQuery(input.projectId, input.path),
    listCanvasesQuery(input.projectId),
    readCanvasQuery(input.projectId, input.canvasId, input.path),
    overlayQuery(input.path),
  ],
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'none',
} as const satisfies ProjectMutationDefinition<'promoteCanvas', PromoteCanvasInput, 'none'>

/** Tracking project defaults changes only what that checkout's overlay carries. */
export const promoteOverrides = {
  procedure: projectsProcedures.promoteOverrides,
  procedureName: 'promoteOverrides',
  affectedQueries: (input: PromoteOverridesInput): readonly ProjectsQuery[] => [
    overlayQuery(input.path),
  ],
  optimistic: false,
  requiresAuthoritativeRefetch: true,
  selectionEffect: 'none',
} as const satisfies ProjectMutationDefinition<'promoteOverrides', PromoteOverridesInput, 'none'>

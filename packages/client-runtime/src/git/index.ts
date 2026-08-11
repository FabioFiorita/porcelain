/**
 * Shared Git workspace client semantics (GIT-003).
 *
 * Framework-neutral project-scoped identities, exact non-optimistic workspace mutation
 * consequences, and typed working-tree notification mapping. Web and mobile adapters bind these
 * definitions to their transport and cache layers in GIT-004.
 */

export {
  type GitWorkspaceMutation,
  type GitWorkspaceMutationDefinition,
  gitWorkspaceMutations,
} from './git-mutations'
export { gitNotificationEffects } from './git-notifications'
export {
  type GitBranchesQuery,
  type GitCommitConventionsQuery,
  type GitDiffQuery,
  type GitFlowQuery,
  type GitHeadQuery,
  GitIdentityError,
  type GitLogQuery,
  type GitQuery,
  type GitRangeFlowQuery,
  type GitStatusQuery,
  type GitSuggestionsQuery,
  type GitWorkspaceQuery,
  type GitWorktreesQuery,
  gitBranchesQuery,
  gitCommitConventionsQuery,
  gitDiffQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitProjectKey,
  gitQuerySchema,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  gitWorkspaceQuerySchema,
  gitWorktreesQuery,
  type ReviewedPathsQuery,
  type ReviewReadingQuery,
  type ReviewViewQuery,
  type ReviewWorkspaceQuery,
  reviewedPathsQuery,
  reviewReadingQuery,
  reviewViewQuery,
  reviewWorkspaceQuerySchema,
  type WorktreeInboxQuery,
  worktreeInboxQuery,
} from './git-queries'

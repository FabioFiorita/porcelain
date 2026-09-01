/**
 * Shared Git client semantics.
 *
 * Framework-neutral exact identities, freshness families, non-optimistic mutation consequences,
 * and typed Git/Review notification mapping. Web and mobile bind these definitions to their
 * transport and cache layers.
 */

export {
  type GitMutation,
  type GitMutationDefinition,
  gitMutations,
} from './git-mutations'
export { gitNotificationEffects } from './git-notifications'
export {
  type DiffReadingScope,
  type GitBranchesQuery,
  type GitCommitConventionsQuery,
  type GitCommitDiffQuery,
  type GitCommitFlowQuery,
  type GitCommitMessageQuery,
  type GitCommitModelsQuery,
  type GitDiffFileQuery,
  type GitDiffReadingQuery,
  type GitFileLogQuery,
  type GitFlowQuery,
  type GitHeadQuery,
  GitIdentityError,
  type GitLogQuery,
  type GitQuery,
  type GitRangeDiffFileQuery,
  type GitRangeFlowQuery,
  type GitStatusQuery,
  type GitSuggestionsQuery,
  type GitWorkspaceQuery,
  type GitWorktreesQuery,
  gitBranchesQuery,
  gitCommitConventionsQuery,
  gitCommitDiffQuery,
  gitCommitFlowQuery,
  gitCommitMessageQuery,
  gitCommitModelsQuery,
  gitDiffFileQuery,
  gitDiffReadingQuery,
  gitFileLogQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitProjectKey,
  gitQuerySchema,
  gitRangeDiffFileQuery,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  gitWorkspaceQuerySchema,
  gitWorktreesQuery,
} from './git-queries'
export {
  dedupeGitQueryEffects,
  type GitDiffQuery,
  type GitDiffReadingFamilyEffect,
  type GitFileLogFamilyEffect,
  type GitLogFamilyEffect,
  type GitQueryEffect,
  type GitRangeDiffQuery,
  gitDiffQuery,
  gitDiffReadingQueryFamily,
  gitFileLogQueryFamily,
  gitLogQueryFamily,
  gitQueryEffectMatchesQuery,
  gitQueryProjectPath,
  gitRangeDiffQuery,
} from './git-query-effects'

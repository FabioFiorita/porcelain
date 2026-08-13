/** Web Git feature boundary: transport, semantic cache identities, and Git-owned actions. */

export type { BranchRef, GitHead, Worktree } from '@porcelain/contracts/git'
export type { ReviewInboxRow } from '@porcelain/contracts/review'
export type { QuickCommandId } from './git-mutations'
export {
  useCommit,
  useCommitGeneration,
  useDiscardFile,
  useFileStaging,
  usePush,
  useQuickCommand,
  useStageAll,
} from './git-mutations'
export type { ApplyGitNotificationOptions } from './git-notifications'
export {
  applyGitFreshnessRequirement,
  applyGitNotification,
  applyReviewNotification,
  useGitNotificationSubscription,
} from './git-notifications'
export {
  gitQueryKey,
  invalidateAllGitQueries,
  invalidateGitEffects,
  invalidateGitProject,
  invalidateGitWorkingTree,
  isGitQueryKey,
  parseGitQueryKey,
} from './git-query-filter'
export type { DiffReadingScope } from './git-reads'
export {
  useBranchFlow,
  useCommitConventions,
  useCommitDiff,
  useCommitFlow,
  useCommitMessage,
  useCommitModels,
  useDiffFile,
  useDiffFileHoverPrefetch,
  useDiffFilePrefetch,
  useDiffReading,
  useFetchCommitMessage,
  useFileLog,
  useGitFlow,
  useGitLog,
  useGitStatus,
  useGitSuggestions,
} from './git-reads'
export { useReviewedPaths, useSetReviewed, useToggleReviewed } from './git-reviewed'
export type { GitMutationAction } from './workspace/git-mutations'
export { useGitAddWorktree, useGitCheckout, useGitCreateBranch } from './workspace/git-mutations'
export { useGitWorkspace } from './workspace/git-queries'

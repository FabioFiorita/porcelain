/**
 * Mobile Git feature boundary — the only Git client surface in this app.
 *
 * Reads, writes, notification/recovery and the semantic cache identities all live behind this
 * index; nothing outside imports a Git procedure, query key or transport.
 */

export type { DiffReadingScope } from '@porcelain/client-runtime/git'
export type {
  Commit,
  CommitConventions,
  DiffFileResult,
  DiffHunk,
  DiffLine,
  DiffReadingOutput,
  FileStatus,
  FlowFile,
  FlowGroup,
  GitSuggestion,
  ReadingFile,
} from '@porcelain/contracts/git'
export type { DiffFile, DiffSource } from './git-diff'
export { changesDiffSource, useDiffFile, useDiffReading } from './git-diff'
export type { QuickCommandId } from './git-mutations'
export {
  QUICK_COMMANDS,
  useCommit,
  useCommitGeneration,
  useDiscardFile,
  useFileStaging,
  useInvalidateGitGrouping,
  usePush,
  useQuickCommand,
  useStageAll,
} from './git-mutations'
export {
  applyGitFreshnessRequirement,
  applyGitNotification,
  GitNotificationBridge,
} from './git-notifications'
export type {
  CommitFlow,
  GitFlowOptions,
  GitFlowRead,
  GitLog,
  GitRangeFlowRead,
} from './git-queries'
export {
  useChangedFileCount,
  useCommitConventions,
  useCommitFlow,
  useCommitMessage,
  useCommitModels,
  useFetchCommitMessage,
  useFileLog,
  useGitFlow,
  useGitHead,
  useGitLog,
  useGitRangeFlow,
  useGitStatus,
  useGitSuggestions,
  useHeadLabel,
  useWorkingFlow,
} from './git-queries'
export {
  gitQueryMatchesEffect,
  invalidateAllGitQueries,
  invalidateGitEffects,
  invalidateGitProject,
  invalidateGitWorkingTree,
} from './git-query-filter'
export type { GitQueryKey } from './git-query-key'
export { gitQueryKey, isGitQueryKey, parseGitQueryKey } from './git-query-key'
export type {
  BranchRef,
  GitHead,
  GitMutationAction,
  GitWorkspaceOptions,
  GitWorkspaceQueryResult,
  Worktree,
} from './workspace'
export {
  useGitAddWorktree,
  useGitCheckout,
  useGitCreateBranch,
  useGitWorkspace,
} from './workspace'

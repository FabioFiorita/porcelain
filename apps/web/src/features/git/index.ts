/** Web Git feature boundary. Workspace is the first Git client slice; later Git reads extend it. */

export type {
  BranchRef,
  GitHead,
  GitMutationAction,
  GitWorkspaceQueryKey,
  Worktree,
  WorktreeInboxRow,
} from './workspace'
export {
  applyGitFreshnessRequirement,
  applyGitNotification,
  gitWorkspaceQueryKey,
  invalidateGitProjectForRecovery,
  isGitWorkspaceQueryKey,
  parseGitWorkspaceQueryKey,
  useGitAddWorktree,
  useGitCheckout,
  useGitCreateBranch,
  useGitNotificationSubscription,
  useGitWorkspace,
} from './workspace'

/** Mobile Git feature boundary. Workspace is the first Git client slice; later reads extend it. */

export type {
  BranchRef,
  GitBranchSheet,
  GitHead,
  GitMutationAction,
  GitWorkspaceOptions,
  GitWorkspaceQueryKey,
  GitWorkspaceQueryResult,
  GitWorktreeSheet,
  Worktree,
  WorktreeInboxRow,
} from './workspace'
export {
  applyGitFreshnessRequirement,
  applyGitNotification,
  GitNotificationBridge,
  gitWorkspaceQueryKey,
  isGitWorkspaceQueryKey,
  parseGitWorkspaceQueryKey,
  useGitAddWorktree,
  useGitBranchSheet,
  useGitCheckout,
  useGitCreateBranch,
  useGitWorkspace,
  useGitWorktreeSheet,
} from './workspace'

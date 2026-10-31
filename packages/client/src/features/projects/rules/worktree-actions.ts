import type { ReviewArchivePlan } from '@porcelain/contracts/reviews';
import type { WorktreeCleanupPlan } from '@porcelain/contracts/projects';
import type { ReviewGitSettings } from '@porcelain/contracts/access';
import type { ListBranchBasesResponse } from '@porcelain/contracts/changes';
export const archiveSettings = [
  { key: 'archiveDeleteWorktree', label: 'Delete local worktree' },
  { key: 'archiveDeleteLocalBranch', label: 'Delete local branch' },
  { key: 'archiveDeleteRemoteBranch', label: 'Delete remote branch' },
] as const;
export function archiveOptions(preferences: {
  archiveDeleteWorktree: boolean;
  archiveDeleteLocalBranch: boolean;
  archiveDeleteRemoteBranch: boolean;
}) {
  return {
    deleteWorktree: preferences.archiveDeleteWorktree,
    deleteLocalBranch: preferences.archiveDeleteLocalBranch,
    deleteRemoteBranch: preferences.archiveDeleteRemoteBranch,
  };
}

export const worktreeCleanupFields = [
  { key: 'deleteWorktree', label: archiveSettings[0].label },
  { key: 'deleteLocalBranch', label: archiveSettings[1].label },
  { key: 'deleteRemoteBranch', label: archiveSettings[2].label },
] as const;
export function worktreeCleanupOptions(
  settings: ReviewGitSettings,
  detached: boolean,
) {
  return {
    ...archiveOptions(settings),
    deleteLocalBranch: !detached && settings.archiveDeleteLocalBranch,
    deleteRemoteBranch: !detached && settings.archiveDeleteRemoteBranch,
  };
}
export function worktreeBranchChoices(
  bases: ListBranchBasesResponse['bases'],
  worktrees: readonly { id: string; branch: string | undefined }[],
  worktreeId: string,
) {
  return bases
    .filter((branch) => !branch.remote)
    .map((branch) => ({
      ...branch,
      current: worktrees.some(
        (worktree) =>
          worktree.id === worktreeId && worktree.branch === branch.name,
      ),
      inUse: worktrees.some(
        (worktree) =>
          worktree.id !== worktreeId && worktree.branch === branch.name,
      ),
    }));
}

export function worktreeCleanupDescription(plan: WorktreeCleanupPlan) {
  return [
    plan.mainCheckout
      ? 'The project’s main checkout and its branches are protected. Nothing will be deleted.'
      : undefined,
    plan.worktreePath ? `Delete worktree: ${plan.worktreePath}` : undefined,
    plan.worktreePath
      ? 'The entire worktree folder will be permanently deleted, including ignored files such as .env and local build output.'
      : undefined,
    plan.detachWorktreePath
      ? `Keep worktree detached from its branch: ${plan.detachWorktreePath}`
      : undefined,
    plan.localBranch ? `Delete local branch: ${plan.localBranch}` : undefined,
    plan.remoteBranch
      ? `Delete remote branch: ${plan.remoteBranch}`
      : undefined,
    plan.remoteBranchNote,
    !plan.mainCheckout &&
    !plan.worktreePath &&
    !plan.localBranch &&
    !plan.remoteBranch
      ? 'Nothing will be deleted with the current settings.'
      : undefined,
    plan.dirty
      ? 'Warning: this worktree has uncommitted changes. Deleting the worktree permanently discards them.'
      : undefined,
    plan.unpushed
      ? 'Warning: this branch has commits not confirmed on its remote. Deleting branches may lose those commits.'
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function worktreeCleanupFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Deletion could not be completed. Prepare the deletion again.';
}

export function archiveDescription(plan: ReviewArchivePlan) {
  return [
    'The review and its saved revisions will remain available with Show older reviews.',
    worktreeCleanupDescription(plan),
  ].join('\n\n');
}

export function archiveFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Archiving failed. Try preparing the archive again.';
}

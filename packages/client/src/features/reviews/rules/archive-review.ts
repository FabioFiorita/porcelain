import type { ReviewArchivePlan } from '@porcelain/contracts/reviews';
export function archiveDescription(plan: ReviewArchivePlan) {
  return [
    'The review and its saved revisions will remain under Closed.',
    plan.mainCheckout
      ? 'The project’s main checkout and its branches are protected. Nothing will be deleted.'
      : undefined,
    plan.worktreePath ? `Delete worktree: ${plan.worktreePath}` : undefined,
    plan.detachWorktreePath
      ? `Keep worktree detached from its branch: ${plan.detachWorktreePath}`
      : undefined,
    plan.localBranch ? `Delete local branch: ${plan.localBranch}` : undefined,
    plan.remoteBranch
      ? `Delete remote branch: ${plan.remoteBranch}`
      : undefined,
    !plan.mainCheckout &&
    !plan.worktreePath &&
    !plan.localBranch &&
    !plan.remoteBranch
      ? 'Nothing will be deleted with the current settings.'
      : undefined,
    plan.dirty
      ? 'Warning: this worktree has uncommitted or ignored files. Deleting the worktree permanently discards them.'
      : undefined,
    plan.unpushed
      ? 'Warning: this branch has commits not confirmed on its remote. Deleting branches may lose those commits.'
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
}

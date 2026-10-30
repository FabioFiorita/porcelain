import type { ReviewArchivePlan } from '@porcelain/contracts/reviews';
export function archiveDescription(plan: ReviewArchivePlan) {
  return [
    'The review and its saved revisions will remain available with Show older reviews.',
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

export function archiveFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Archiving failed. Try preparing the archive again.';
}

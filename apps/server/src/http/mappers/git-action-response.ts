import type { GitActionReceipt } from '../../models/git-action.ts';
export function gitActionStatus(value: GitActionReceipt) {
  if (value.state === 'running') return 202;
  if (value.state === 'indeterminate' || value.state === 'interrupted')
    return 503;
  if (value.state === 'rejected' || value.state === 'conflicted') return 409;
  return 200;
}

export function toGitActionReceipt(value: GitActionReceipt) {
  return {
    requestId: value.requestId,
    projectId: value.projectId,
    worktreeId: value.worktreeId,
    action: value.action,
    state:
      value.state === 'indeterminate' ? ('interrupted' as const) : value.state,
    ...(value.reason ? { reason: value.reason } : {}),
    ...(value.message ? { message: value.message } : {}),
    progress: value.progress ?? [],
    ...(value.result ? { result: value.result } : {}),
    acceptedAt: value.acceptedAt,
    ...(value.finishedAt ? { finishedAt: value.finishedAt } : {}),
  };
}

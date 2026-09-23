import type { GitActionReceipt } from './git-action.ts';

export type GitActionReceiptView = Pick<
  GitActionReceipt,
  | 'requestId'
  | 'projectId'
  | 'worktreeId'
  | 'action'
  | 'reason'
  | 'message'
  | 'result'
  | 'acceptedAt'
  | 'finishedAt'
> & {
  state: Exclude<GitActionReceipt['state'], 'indeterminate'>;
  progress: string[];
};

export function gitActionReceiptView(
  receipt: GitActionReceipt,
): GitActionReceiptView {
  return {
    requestId: receipt.requestId,
    projectId: receipt.projectId,
    worktreeId: receipt.worktreeId,
    action: receipt.action,
    state: receipt.state === 'indeterminate' ? 'interrupted' : receipt.state,
    ...(receipt.reason ? { reason: receipt.reason } : {}),
    ...(receipt.message ? { message: receipt.message } : {}),
    progress: receipt.progress ?? [],
    ...(receipt.result ? { result: receipt.result } : {}),
    acceptedAt: receipt.acceptedAt,
    ...(receipt.finishedAt ? { finishedAt: receipt.finishedAt } : {}),
  };
}

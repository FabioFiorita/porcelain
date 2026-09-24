import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';

export function gitActionReceiptView(
  receipt: GitActionReceipt,
): GitActionReceiptView {
  return {
    requestId: receipt.requestId,
    projectId: receipt.projectId,
    worktreeId: receipt.worktreeId,
    action: receipt.action,
    state: receipt.state,
    reason: receipt.reason,
    message: receipt.message,
    progress: receipt.progress,
    result: receipt.result,
    acceptedAt: receipt.acceptedAt,
    finishedAt: receipt.finishedAt,
  };
}

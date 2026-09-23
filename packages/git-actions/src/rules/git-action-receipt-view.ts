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
    ...(receipt.reason === undefined ? {} : { reason: receipt.reason }),
    ...(receipt.message === undefined ? {} : { message: receipt.message }),
    progress: receipt.progress,
    ...(receipt.result === undefined ? {} : { result: receipt.result }),
    acceptedAt: receipt.acceptedAt,
    ...(receipt.finishedAt === undefined
      ? {}
      : { finishedAt: receipt.finishedAt }),
  };
}

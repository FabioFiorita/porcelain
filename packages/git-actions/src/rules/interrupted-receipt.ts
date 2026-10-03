import type { GitActionReceipt } from '../models/git-action-receipt.ts';

export function interruptedReceipt(
  receipt: GitActionReceipt,
  finishedAt: string,
): GitActionReceipt {
  return {
    ...receipt,
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    refreshRequired: true,
    finishedAt,
  };
}

import type { FinishedGitAction } from '../models/git-action-receipt.ts';

export function expiredReceipts(
  finished: readonly FinishedGitAction[],
  now: string,
  retentionMs: number,
): string[] {
  return finished
    .filter(
      (receipt) =>
        Date.parse(now) - Date.parse(receipt.finishedAt) > retentionMs,
    )
    .map((receipt) => receipt.requestId);
}

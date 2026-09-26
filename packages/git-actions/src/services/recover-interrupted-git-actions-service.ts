import type { WorktreeKey } from '@porcelain/kernel/models';
import type { Clock } from '@porcelain/kernel/ports';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { interruptedReceipt } from '../rules/interrupted-receipt.ts';

export class RecoverInterruptedGitActionsService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(input: WorktreeKey): void {
    const finishedAt = this.clock.now();
    for (const receipt of this.gitActionReceipts.running())
      if (receipt.worktreeId === input.worktreeId)
        this.gitActionReceipts.save(interruptedReceipt(receipt, finishedAt));
  }
}

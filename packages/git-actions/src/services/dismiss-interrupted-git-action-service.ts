import type { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import type { DismissInterruptedGitActionInput } from '../models/dismiss-interrupted-git-action.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';

export class DismissInterruptedGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(input: DismissInterruptedGitActionInput): void {
    const receipt = this.gitActionReceipts.read({
      requestId: input.requestId,
    });
    if (!receipt) throw new GitActionNotFoundError();
    if (
      receipt.projectId !== input.projectId ||
      receipt.worktreeId !== input.worktreeId ||
      receipt.state !== 'interrupted'
    )
      throw new GitActionReceiptMismatchError();
    this.gitActionReceipts.save({ ...receipt, dismissedAt: this.clock.now() });
  }
}

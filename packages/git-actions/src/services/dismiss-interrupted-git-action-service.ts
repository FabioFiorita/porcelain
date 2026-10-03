import type { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import type {
  DismissInterruptedGitActionInput,
  DismissInterruptedGitActionResult,
} from '../models/dismiss-interrupted-git-action.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class DismissInterruptedGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(
    input: DismissInterruptedGitActionInput,
  ): DismissInterruptedGitActionResult {
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
    if (receipt.dismissedAt !== undefined)
      return {
        kind: 'already-dismissed',
        receipt: gitActionReceiptView(receipt),
      };
    const dismissed = { ...receipt, dismissedAt: this.clock.now() };
    this.gitActionReceipts.save(dismissed);
    return { kind: 'dismissed', receipt: gitActionReceiptView(dismissed) };
  }
}

import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import { GitActionReceiptMismatchError } from '../errors/git-action-receipt-mismatch-error.ts';
import type { DismissInterruptedGitActionInput } from '../models/git-action-operations.ts';
import type { Clock } from '../ports/clock.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';

export class DismissInterruptedGitActionService {
  private readonly gitActionReceiptStore: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceiptStore: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceiptStore = gitActionReceiptStore;
    this.clock = clock;
  }

  execute(input: DismissInterruptedGitActionInput): void {
    const receipt = this.gitActionReceiptStore.read(input.requestId);
    if (!receipt) throw new GitActionNotFoundError();
    if (
      receipt.projectId !== input.projectId ||
      receipt.worktreeId !== input.worktreeId ||
      receipt.state !== 'interrupted'
    )
      throw new GitActionReceiptMismatchError();
    this.gitActionReceiptStore.save({
      ...receipt,
      dismissedAt: Date.parse(this.clock.now()),
    });
  }
}

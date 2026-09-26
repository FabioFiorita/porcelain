import type { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import type {
  FinishGitActionInput,
  FinishGitActionResult,
} from '../models/finish-git-action.ts';
import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class FinishGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(input: FinishGitActionInput): FinishGitActionResult {
    const current = this.gitActionReceipts.read({
      requestId: input.requestId,
    });
    if (!current) throw new GitActionNotFoundError();
    const { outcome } = input;
    const finished: GitActionReceipt = {
      ...current,
      state: outcome.state === 'indeterminate' ? 'interrupted' : outcome.state,
      reason: outcome.reason,
      message: outcome.message,
      result: outcome.result,
      refreshRequired: outcome.refreshRequired,
      finishedAt: this.clock.now(),
    };
    this.gitActionReceipts.save(finished);
    return gitActionReceiptView(finished);
  }
}

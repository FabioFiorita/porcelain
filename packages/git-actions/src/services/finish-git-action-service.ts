import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import type { FinishGitActionInput } from '../models/git-action-operations.ts';
import type { GitActionReceipt } from '../models/git-action-receipt.ts';
import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';
import type { Clock } from '../ports/clock.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class FinishGitActionService {
  private readonly gitActionReceiptStore: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceiptStore: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceiptStore = gitActionReceiptStore;
    this.clock = clock;
  }

  execute(input: FinishGitActionInput): GitActionReceiptView {
    const current = this.gitActionReceiptStore.read(input.requestId);
    if (!current) throw new GitActionNotFoundError();
    const { outcome } = input;
    const finished: GitActionReceipt = {
      ...current,
      state: outcome.state === 'indeterminate' ? 'interrupted' : outcome.state,
      ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
      ...(outcome.message === undefined ? {} : { message: outcome.message }),
      ...(outcome.result === undefined ? {} : { result: outcome.result }),
      refreshRequired: outcome.refreshRequired,
      finishedAt: Date.parse(this.clock.now()),
    };
    this.gitActionReceiptStore.save(finished);
    return gitActionReceiptView(finished);
  }
}

import type { Clock } from '@porcelain/kernel/ports';
import type { RecoverInterruptedGitActionsInput } from '../models/git-action-operations.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import type { RunningGitActionStore } from '../ports/running-git-action-store.ts';

export class RecoverInterruptedGitActionsService {
  private readonly runningGitActionStore: RunningGitActionStore;
  private readonly gitActionReceiptStore: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(
    runningGitActionStore: RunningGitActionStore,
    gitActionReceiptStore: GitActionReceiptStore,
    clock: Clock,
  ) {
    this.runningGitActionStore = runningGitActionStore;
    this.gitActionReceiptStore = gitActionReceiptStore;
    this.clock = clock;
  }

  execute(input: RecoverInterruptedGitActionsInput): void {
    void input;
    const finishedAt = Date.parse(this.clock.now());
    for (const receipt of this.runningGitActionStore.running())
      this.gitActionReceiptStore.save({
        ...receipt,
        state: 'interrupted',
        reason: 'OUTCOME_UNKNOWN',
        refreshRequired: true,
        finishedAt,
      });
  }
}

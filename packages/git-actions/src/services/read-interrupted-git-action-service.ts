import type { ReadInterruptedGitActionInput } from '../models/git-action-operations.ts';
import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';
import type { InterruptedGitActionStore } from '../ports/interrupted-git-action-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadInterruptedGitActionService {
  private readonly interruptedGitActionStore: InterruptedGitActionStore;

  constructor(interruptedGitActionStore: InterruptedGitActionStore) {
    this.interruptedGitActionStore = interruptedGitActionStore;
  }

  execute(
    input: ReadInterruptedGitActionInput,
  ): GitActionReceiptView | undefined {
    const receipt = this.interruptedGitActionStore.latestUndismissed(
      input.worktreeId,
    );
    return receipt && gitActionReceiptView(receipt);
  }
}

import type { Clock } from '@porcelain/kernel/ports';
import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import type {
  InterruptGitActionInput,
  InterruptGitActionResult,
} from '../models/interrupt-git-action.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';
import { interruptedReceipt } from '../rules/interrupted-receipt.ts';

export class InterruptGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;

  constructor(gitActionReceipts: GitActionReceiptStore, clock: Clock) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
  }

  execute(input: InterruptGitActionInput): InterruptGitActionResult {
    const current = this.gitActionReceipts.read({
      requestId: input.requestId,
    });
    if (!current) throw new GitActionNotFoundError();
    if (current.state !== 'running') return gitActionReceiptView(current);
    const interrupted = interruptedReceipt(current, this.clock.now());
    this.gitActionReceipts.save(interrupted);
    return gitActionReceiptView(interrupted);
  }
}

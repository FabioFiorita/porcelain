import type {
  ReadInterruptedGitActionInput,
  ReadInterruptedGitActionResult,
} from '../models/read-interrupted-git-action.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadInterruptedGitActionService {
  private readonly gitActionReceipts: GitActionReceiptStore;

  constructor(gitActionReceipts: GitActionReceiptStore) {
    this.gitActionReceipts = gitActionReceipts;
  }

  execute(
    input: ReadInterruptedGitActionInput,
  ): ReadInterruptedGitActionResult {
    const receipt = this.gitActionReceipts.latestInterrupted({
      worktreeId: input.worktreeId,
    });
    return receipt
      ? { kind: 'interrupted', receipt: gitActionReceiptView(receipt) }
      : { kind: 'none' };
  }
}

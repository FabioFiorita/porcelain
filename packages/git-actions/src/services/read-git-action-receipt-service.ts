import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import type { ReadGitActionReceiptInput } from '../models/git-action-operations.ts';
import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class ReadGitActionReceiptService {
  private readonly gitActionReceiptStore: GitActionReceiptStore;

  constructor(gitActionReceiptStore: GitActionReceiptStore) {
    this.gitActionReceiptStore = gitActionReceiptStore;
  }

  execute(input: ReadGitActionReceiptInput): GitActionReceiptView {
    const receipt = this.gitActionReceiptStore.read(input.requestId);
    if (!receipt) throw new GitActionNotFoundError();
    return gitActionReceiptView(receipt);
  }
}

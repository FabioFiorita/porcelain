import { GitActionNotFoundError } from '../errors/git-action-not-found-error.ts';
import type { GitActionReceipt } from '../models/git-action.ts';
import type { GitActionStore } from '../ports/git-action-store.ts';

export class ReadGitActionReceiptService {
  private readonly store: Pick<GitActionStore, 'receipt'>;

  constructor(store: Pick<GitActionStore, 'receipt'>) {
    this.store = store;
  }

  execute(requestId: string): GitActionReceipt {
    const receipt = this.store.receipt(requestId);
    if (!receipt) throw new GitActionNotFoundError();
    return receipt;
  }
}

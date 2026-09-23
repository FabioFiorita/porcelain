import type { GitActionReceipt } from '../models/git-action.ts';
import type { GitActionStore } from '../ports/git-action-store.ts';

export class ReadInterruptedGitActionService {
  private readonly store: Pick<GitActionStore, 'interrupted'>;

  constructor(store: Pick<GitActionStore, 'interrupted'>) {
    this.store = store;
  }

  execute(worktreeId: string): GitActionReceipt | undefined {
    return this.store.interrupted(worktreeId);
  }
}

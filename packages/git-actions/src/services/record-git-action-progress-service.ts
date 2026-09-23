import type { GitActionReceipt } from '../models/git-action.ts';
import type { GitActionStore } from '../ports/git-action-store.ts';

export class RecordGitActionProgressService {
  private readonly store: Pick<GitActionStore, 'receipt' | 'finish'>;

  constructor(store: Pick<GitActionStore, 'receipt' | 'finish'>) {
    this.store = store;
  }

  execute(requestId: string, line: string): GitActionReceipt | undefined {
    const current = this.store.receipt(requestId);
    if (current?.state !== 'running') return undefined;
    const updated = {
      ...current,
      progress: [...(current.progress ?? []), line].slice(-200),
    };
    this.store.finish(updated);
    return updated;
  }
}

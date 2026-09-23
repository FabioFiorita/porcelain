import type { RecordGitActionProgressInput } from '../models/git-action-operations.ts';
import type { GitActionReceiptView } from '../models/git-action-receipt-view.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

const PROGRESS_LINES = 200;

export class RecordGitActionProgressService {
  private readonly gitActionReceiptStore: GitActionReceiptStore;

  constructor(gitActionReceiptStore: GitActionReceiptStore) {
    this.gitActionReceiptStore = gitActionReceiptStore;
  }

  execute(
    input: RecordGitActionProgressInput,
  ): GitActionReceiptView | undefined {
    const current = this.gitActionReceiptStore.read(input.requestId);
    if (current?.state !== 'running') return undefined;
    const updated = {
      ...current,
      progress: [...current.progress, input.line].slice(-PROGRESS_LINES),
    };
    this.gitActionReceiptStore.save(updated);
    return gitActionReceiptView(updated);
  }
}

import type {
  RecordGitActionProgressInput,
  RecordGitActionProgressOptions,
  RecordGitActionProgressResult,
} from '../models/record-git-action-progress.ts';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { gitActionReceiptView } from '../rules/git-action-receipt-view.ts';

export class RecordGitActionProgressService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly options: RecordGitActionProgressOptions;

  constructor(
    gitActionReceipts: GitActionReceiptStore,
    options: RecordGitActionProgressOptions,
  ) {
    this.gitActionReceipts = gitActionReceipts;
    this.options = options;
  }

  execute(input: RecordGitActionProgressInput): RecordGitActionProgressResult {
    const current = this.gitActionReceipts.read({
      requestId: input.requestId,
    });
    if (current?.state !== 'running') return { kind: 'not-running' };
    const updated = {
      ...current,
      progress: [...current.progress, input.line].slice(
        -this.options.progressLines,
      ),
    };
    this.gitActionReceipts.save(updated);
    return { kind: 'recorded', receipt: gitActionReceiptView(updated) };
  }
}

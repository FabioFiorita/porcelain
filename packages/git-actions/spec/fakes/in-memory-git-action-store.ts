import type { GitActionReceipt } from '../../src/models/index.ts';
import type {
  GitActionReceiptStore,
  GitActionRetentionStore,
  InterruptedGitActionStore,
  RunningGitActionStore,
} from '../../src/ports/index.ts';

export class InMemoryGitActionStore
  implements
    GitActionReceiptStore,
    RunningGitActionStore,
    InterruptedGitActionStore,
    GitActionRetentionStore
{
  private readonly rows = new Map<string, GitActionReceipt>();

  constructor(receipts: readonly GitActionReceipt[] = []) {
    for (const receipt of receipts) this.rows.set(receipt.requestId, receipt);
  }

  read(requestId: string): GitActionReceipt | undefined {
    const row = this.rows.get(requestId);
    return row && structuredClone(row);
  }

  insert(receipt: GitActionReceipt): void {
    if (this.rows.has(receipt.requestId))
      throw new Error('UNIQUE constraint failed: git_action_receipts');
    this.rows.set(receipt.requestId, structuredClone(receipt));
  }

  save(receipt: GitActionReceipt): void {
    if (this.rows.has(receipt.requestId))
      this.rows.set(receipt.requestId, structuredClone(receipt));
  }

  running(): GitActionReceipt[] {
    return [...this.rows.values()]
      .filter((row) => row.state === 'running')
      .map((row) => structuredClone(row));
  }

  latestUndismissed(worktreeId: string): GitActionReceipt | undefined {
    const [latest] = [...this.rows.values()]
      .filter(
        (row) =>
          row.worktreeId === worktreeId &&
          row.state === 'interrupted' &&
          row.dismissedAt === undefined,
      )
      .sort((left, right) => (right.finishedAt ?? 0) - (left.finishedAt ?? 0));
    return latest && structuredClone(latest);
  }

  deleteFinishedBefore(cutoff: number): void {
    for (const [requestId, row] of this.rows)
      if (row.finishedAt !== undefined && row.finishedAt < cutoff)
        this.rows.delete(requestId);
  }

  all(): GitActionReceipt[] {
    return [...this.rows.values()].map((row) => structuredClone(row));
  }
}

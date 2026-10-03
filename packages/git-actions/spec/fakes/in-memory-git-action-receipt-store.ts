import type {
  FinishedGitAction,
  GitActionReceipt,
} from '../../src/models/git-action-receipt.ts';
import type { GitActionReceiptStore } from '../../src/ports/git-action-receipt-store.ts';

export class InMemoryGitActionReceiptStore implements GitActionReceiptStore {
  private readonly rows: Map<string, GitActionReceipt>;
  private readonly saved = new Map<string, GitActionReceipt>();

  constructor(receipts: readonly GitActionReceipt[] = []) {
    this.rows = new Map(
      receipts.map((receipt) => [receipt.requestId, structuredClone(receipt)]),
    );
  }

  read(input: { requestId: string }): GitActionReceipt | undefined {
    const inserted = this.rows.get(input.requestId);
    return inserted && this.current(inserted);
  }

  insert(input: GitActionReceipt): void {
    this.rows.set(input.requestId, structuredClone(input));
    this.saved.delete(input.requestId);
  }

  save(input: GitActionReceipt): void {
    this.saved.set(input.requestId, structuredClone(input));
  }

  running(): GitActionReceipt[] {
    return this.all().filter((receipt) => receipt.state === 'running');
  }

  latestInterrupted(input: {
    worktreeId: string;
  }): GitActionReceipt | undefined {
    return this.all()
      .filter(
        (receipt) =>
          receipt.worktreeId === input.worktreeId &&
          receipt.state === 'interrupted' &&
          receipt.dismissedAt === undefined,
      )
      .sort((left, right) =>
        (right.finishedAt ?? '').localeCompare(left.finishedAt ?? ''),
      )
      .at(0);
  }

  finished(): FinishedGitAction[] {
    return this.all().flatMap(({ requestId, finishedAt }) =>
      [finishedAt]
        .filter((at) => at !== undefined)
        .map((at) => ({ requestId, finishedAt: at })),
    );
  }

  remove(input: { requestIds: string[] }): void {
    input.requestIds.forEach((requestId) => {
      this.rows.delete(requestId);
      this.saved.delete(requestId);
    });
  }

  all(): GitActionReceipt[] {
    return [...this.rows.values()].map((receipt) => this.current(receipt));
  }

  private current(inserted: GitActionReceipt): GitActionReceipt {
    return structuredClone(this.saved.get(inserted.requestId) ?? inserted);
  }
}

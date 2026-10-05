import { Effect } from 'effect';
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

  read(input: {
    requestId: string;
  }): Effect.Effect<GitActionReceipt | undefined> {
    return Effect.sync(() => {
      const inserted = this.rows.get(input.requestId);
      return inserted && this.current(inserted);
    });
  }

  insert(input: GitActionReceipt): Effect.Effect<void> {
    return Effect.sync(() => {
      this.rows.set(input.requestId, structuredClone(input));
      this.saved.delete(input.requestId);
    });
  }

  save(input: GitActionReceipt): Effect.Effect<void> {
    return Effect.sync(() => {
      this.saved.set(input.requestId, structuredClone(input));
    });
  }

  running(): Effect.Effect<GitActionReceipt[]> {
    return Effect.sync(() => {
      return this.all().filter((receipt) => receipt.state === 'running');
    });
  }

  latestInterrupted(input: {
    worktreeId: string;
  }): Effect.Effect<GitActionReceipt | undefined> {
    return Effect.sync(() => {
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
    });
  }

  finished(): Effect.Effect<FinishedGitAction[]> {
    return Effect.sync(() => {
      return this.all().flatMap(({ requestId, finishedAt }) =>
        [finishedAt]
          .filter((at) => at !== undefined)
          .map((at) => ({ requestId, finishedAt: at })),
      );
    });
  }

  remove(input: { requestIds: string[] }): Effect.Effect<void> {
    return Effect.sync(() => {
      input.requestIds.forEach((requestId) => {
        this.rows.delete(requestId);
        this.saved.delete(requestId);
      });
    });
  }

  all(): GitActionReceipt[] {
    return [...this.rows.values()].map((receipt) => this.current(receipt));
  }

  private current(inserted: GitActionReceipt): GitActionReceipt {
    return structuredClone(this.saved.get(inserted.requestId) ?? inserted);
  }
}

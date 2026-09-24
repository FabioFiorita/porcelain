import type { Clock } from '@porcelain/kernel/ports';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { receiptExpired } from '../rules/receipt-expired.ts';

export type ExpireGitActionReceiptsOptions = { retentionMs: number };

export class ExpireGitActionReceiptsService {
  private readonly gitActionReceipts: GitActionReceiptStore;
  private readonly clock: Clock;
  private readonly options: ExpireGitActionReceiptsOptions;

  constructor(
    gitActionReceipts: GitActionReceiptStore,
    clock: Clock,
    options: ExpireGitActionReceiptsOptions,
  ) {
    this.gitActionReceipts = gitActionReceipts;
    this.clock = clock;
    this.options = options;
  }

  execute(): void {
    const now = this.clock.now();
    this.gitActionReceipts.remove({
      requestIds: this.gitActionReceipts
        .finished()
        .filter((receipt) =>
          receiptExpired(receipt.finishedAt, now, this.options.retentionMs),
        )
        .map((receipt) => receipt.requestId),
    });
  }
}

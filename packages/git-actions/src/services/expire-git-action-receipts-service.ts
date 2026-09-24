import type { Clock } from '@porcelain/kernel/ports';
import type { GitActionReceiptStore } from '../ports/git-action-receipt-store.ts';
import { expiredReceipts } from '../rules/expired-receipts.ts';
import type { ExpireGitActionReceiptsOptions } from '../models/expire-git-action-receipts.ts';

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
    this.gitActionReceipts.remove({
      requestIds: expiredReceipts(
        this.gitActionReceipts.finished(),
        this.clock.now(),
        this.options.retentionMs,
      ),
    });
  }
}

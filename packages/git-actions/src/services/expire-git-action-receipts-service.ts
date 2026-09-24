import type { Clock } from '@porcelain/kernel/ports';
import type { ExpireGitActionReceiptsInput } from '../models/git-action-operations.ts';
import type { GitActionRetentionStore } from '../ports/git-action-retention-store.ts';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class ExpireGitActionReceiptsService {
  private readonly gitActionRetentionStore: GitActionRetentionStore;
  private readonly clock: Clock;

  constructor(gitActionRetentionStore: GitActionRetentionStore, clock: Clock) {
    this.gitActionRetentionStore = gitActionRetentionStore;
    this.clock = clock;
  }

  execute(input: ExpireGitActionReceiptsInput): void {
    void input;
    this.gitActionRetentionStore.deleteFinishedBefore(
      Date.parse(this.clock.now()) - RETENTION_MS,
    );
  }
}

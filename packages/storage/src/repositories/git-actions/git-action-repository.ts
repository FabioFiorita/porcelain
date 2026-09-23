import type { GitActionReceipt } from '@porcelain/git-actions/models';
import type {
  GitActionReceiptStore,
  GitActionRetentionStore,
  InterruptedGitActionStore,
  RunningGitActionStore,
} from '@porcelain/git-actions/ports';
import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gitActionReceipts } from '../../db/schema/git-action-receipts.ts';

export class GitActionRepository
  implements
    GitActionReceiptStore,
    RunningGitActionStore,
    InterruptedGitActionStore,
    GitActionRetentionStore
{
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(requestId: string): GitActionReceipt | undefined {
    return this.db
      .select()
      .from(gitActionReceipts)
      .where(eq(gitActionReceipts.requestId, requestId))
      .get()?.value;
  }

  insert(receipt: GitActionReceipt): void {
    this.db.transaction(
      (tx) => {
        tx.insert(gitActionReceipts)
          .values({
            requestId: receipt.requestId,
            projectId: receipt.projectId,
            value: receipt,
          })
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  save(receipt: GitActionReceipt): void {
    this.db.transaction(
      (tx) => {
        tx.update(gitActionReceipts)
          .set({ value: receipt })
          .where(eq(gitActionReceipts.requestId, receipt.requestId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  running(): GitActionReceipt[] {
    return this.db
      .select({ value: gitActionReceipts.value })
      .from(gitActionReceipts)
      .where(
        sql`json_extract(${gitActionReceipts.value}, '$.state') = 'running'`,
      )
      .all()
      .map((row) => row.value);
  }

  latestUndismissed(worktreeId: string): GitActionReceipt | undefined {
    return this.db
      .select({ value: gitActionReceipts.value })
      .from(gitActionReceipts)
      .where(
        sql`json_extract(${gitActionReceipts.value}, '$.worktreeId') = ${worktreeId}
          AND json_extract(${gitActionReceipts.value}, '$.state') = 'interrupted'
          AND json_extract(${gitActionReceipts.value}, '$.dismissedAt') IS NULL`,
      )
      .orderBy(
        sql`CAST(json_extract(${gitActionReceipts.value}, '$.finishedAt') AS INTEGER) DESC`,
      )
      .get()?.value;
  }

  deleteFinishedBefore(cutoff: number): void {
    this.db.transaction(
      (tx) => {
        tx.delete(gitActionReceipts)
          .where(
            sql`CAST(json_extract(${gitActionReceipts.value}, '$.finishedAt') AS INTEGER) < ${cutoff}`,
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

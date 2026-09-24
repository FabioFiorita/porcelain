import type {
  FinishedGitAction,
  GitActionReceipt,
} from '@porcelain/git-actions/models';
import type { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gitActionReceipts } from '../../db/schema/git-action-receipts.ts';

export class SqliteGitActionReceiptStore implements GitActionReceiptStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(input: { requestId: string }): GitActionReceipt | undefined {
    return this.db
      .select()
      .from(gitActionReceipts)
      .where(eq(gitActionReceipts.requestId, input.requestId))
      .get()?.value;
  }

  insert(input: GitActionReceipt): void {
    this.db.transaction(
      (tx) => {
        tx.insert(gitActionReceipts)
          .values({
            requestId: input.requestId,
            projectId: input.projectId,
            value: input,
          })
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  save(input: GitActionReceipt): void {
    this.db.transaction(
      (tx) => {
        tx.update(gitActionReceipts)
          .set({ value: input })
          .where(eq(gitActionReceipts.requestId, input.requestId))
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

  latestInterrupted(input: {
    worktreeId: string;
  }): GitActionReceipt | undefined {
    return this.db
      .select({ value: gitActionReceipts.value })
      .from(gitActionReceipts)
      .where(
        sql`json_extract(${gitActionReceipts.value}, '$.worktreeId') = ${input.worktreeId}
          AND json_extract(${gitActionReceipts.value}, '$.state') = 'interrupted'
          AND json_extract(${gitActionReceipts.value}, '$.dismissedAt') IS NULL`,
      )
      .orderBy(
        sql`json_extract(${gitActionReceipts.value}, '$.finishedAt') DESC`,
      )
      .get()?.value;
  }

  finished(): FinishedGitAction[] {
    return this.db
      .select({
        requestId: gitActionReceipts.requestId,
        finishedAt: sql<string>`json_extract(${gitActionReceipts.value}, '$.finishedAt')`,
      })
      .from(gitActionReceipts)
      .where(
        sql`json_extract(${gitActionReceipts.value}, '$.finishedAt') IS NOT NULL`,
      )
      .all();
  }

  remove(input: { requestIds: string[] }): void {
    this.db.transaction(
      (tx) => {
        tx.delete(gitActionReceipts)
          .where(inArray(gitActionReceipts.requestId, input.requestIds))
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

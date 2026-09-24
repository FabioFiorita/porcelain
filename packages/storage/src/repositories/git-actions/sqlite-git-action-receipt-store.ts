import type {
  FinishedGitAction,
  GitActionReceipt,
} from '@porcelain/git-actions/models';
import type { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gitActionReceipts } from '../../db/schema/git-action-receipts.ts';

type ReceiptRow = typeof gitActionReceipts.$inferSelect;

function receiptFromRow({
  reason,
  message,
  result,
  finishedAt,
  dismissedAt,
  ...receipt
}: ReceiptRow): GitActionReceipt {
  return {
    ...receipt,
    ...(reason === null ? {} : { reason }),
    ...(message === null ? {} : { message }),
    ...(result === null ? {} : { result }),
    ...(finishedAt === null ? {} : { finishedAt }),
    ...(dismissedAt === null ? {} : { dismissedAt }),
  };
}

function outcomeColumns(receipt: GitActionReceipt) {
  return {
    action: receipt.action,
    state: receipt.state,
    reason: receipt.reason ?? null,
    message: receipt.message ?? null,
    refreshRequired: receipt.refreshRequired,
    acceptedAt: receipt.acceptedAt,
    finishedAt: receipt.finishedAt ?? null,
    dismissedAt: receipt.dismissedAt ?? null,
    intent: receipt.intent,
    expected: receipt.expected,
    result: receipt.result ?? null,
    progress: receipt.progress,
  };
}

export class SqliteGitActionReceiptStore implements GitActionReceiptStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  read(input: { requestId: string }): GitActionReceipt | undefined {
    const row = this.db
      .select()
      .from(gitActionReceipts)
      .where(eq(gitActionReceipts.requestId, input.requestId))
      .get();
    return row && receiptFromRow(row);
  }

  insert(input: GitActionReceipt): void {
    this.db.transaction(
      (tx) => {
        tx.insert(gitActionReceipts)
          .values({
            requestId: input.requestId,
            projectId: input.projectId,
            worktreeId: input.worktreeId,
            ...outcomeColumns(input),
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
          .set(outcomeColumns(input))
          .where(eq(gitActionReceipts.requestId, input.requestId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  running(): GitActionReceipt[] {
    return this.db
      .select()
      .from(gitActionReceipts)
      .where(eq(gitActionReceipts.state, 'running'))
      .all()
      .map(receiptFromRow);
  }

  latestInterrupted(input: {
    worktreeId: string;
  }): GitActionReceipt | undefined {
    const row = this.db
      .select()
      .from(gitActionReceipts)
      .where(
        and(
          eq(gitActionReceipts.worktreeId, input.worktreeId),
          eq(gitActionReceipts.state, 'interrupted'),
          isNull(gitActionReceipts.dismissedAt),
        ),
      )
      .orderBy(desc(gitActionReceipts.finishedAt))
      .get();
    return row && receiptFromRow(row);
  }

  finished(): FinishedGitAction[] {
    return this.db
      .select({
        requestId: gitActionReceipts.requestId,
        finishedAt: gitActionReceipts.finishedAt,
      })
      .from(gitActionReceipts)
      .where(isNotNull(gitActionReceipts.finishedAt))
      .all()
      .flatMap(({ requestId, finishedAt }) =>
        finishedAt === null ? [] : [{ requestId, finishedAt }],
      );
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

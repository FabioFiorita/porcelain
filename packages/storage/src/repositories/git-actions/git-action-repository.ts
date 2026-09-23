import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionReceipt,
} from '@porcelain/git-actions/models';
import { GitActionReceiptMismatchError } from '@porcelain/git-actions/errors';
import type { GitActionStore } from '@porcelain/git-actions/ports';
import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gitActionBlocks } from '../../db/schema/git-action-blocks.ts';
import { gitActionPreparations } from '../../db/schema/git-action-preparations.ts';
import { gitActionReceipts } from '../../db/schema/git-action-receipts.ts';

export class GitActionRepository implements GitActionStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  receipt(id: string): GitActionReceipt | undefined {
    return this.db
      .select()
      .from(gitActionReceipts)
      .where(eq(gitActionReceipts.requestId, id))
      .get()?.value;
  }
  acceptDirect(
    scope: { projectId: string; worktreeId: string },
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    requestFingerprint: string,
  ): { receipt: GitActionReceipt; created: boolean } {
    return this.db.transaction(
      () => {
        this.prune();
        const previous = this.receipt(requestId);
        if (previous) {
          if (
            previous.projectId !== scope.projectId ||
            previous.worktreeId !== scope.worktreeId ||
            previous.requestFingerprint !== requestFingerprint
          )
            throw new GitActionReceiptMismatchError();
          return { receipt: previous, created: false };
        }
        const receipt: GitActionReceipt = {
          ...scope,
          requestId,
          action: intent.action,
          intent,
          expected,
          requestFingerprint,
          state: 'running',
          progress: [],
          refreshRequired: false,
          acceptedAt: Date.now(),
        };
        this.db
          .insert(gitActionReceipts)
          .values({ requestId, value: receipt })
          .run();
        return { receipt, created: true };
      },
      { behavior: 'immediate' },
    );
  }
  finish(value: GitActionReceipt): void {
    this.db
      .update(gitActionReceipts)
      .set({ value })
      .where(eq(gitActionReceipts.requestId, value.requestId))
      .run();
  }
  interrupted(worktreeId: string): GitActionReceipt | undefined {
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
  dismissInterrupted(
    scope: { projectId: string; worktreeId: string },
    requestId: string,
  ): void {
    const receipt = this.receipt(requestId);
    if (
      !receipt ||
      receipt.projectId !== scope.projectId ||
      receipt.worktreeId !== scope.worktreeId ||
      receipt.state !== 'interrupted'
    )
      throw new GitActionReceiptMismatchError();
    this.finish({ ...receipt, dismissedAt: Date.now() });
  }
  running(projectId: string): boolean {
    return (
      this.db
        .select({ requestId: gitActionReceipts.requestId })
        .from(gitActionReceipts)
        .where(
          sql`json_extract(${gitActionReceipts.value}, '$.projectId') = ${projectId}
            AND json_extract(${gitActionReceipts.value}, '$.state') = 'running'`,
        )
        .get() !== undefined
    );
  }
  recover(): void {
    this.db.transaction(() => {
      for (const { value } of this.db.select().from(gitActionReceipts).all()) {
        if (value.state === 'running')
          this.finish({
            ...value,
            state: 'interrupted',
            reason: 'OUTCOME_UNKNOWN',
            refreshRequired: true,
            finishedAt: Date.now(),
          });
      }
      this.prune();
      this.db.delete(gitActionBlocks).run();
    });
  }
  private prune(): void {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.db
      .delete(gitActionReceipts)
      .where(
        sql`CAST(json_extract(${gitActionReceipts.value}, '$.finishedAt') AS INTEGER) < ${cutoff}`,
      )
      .run();
    this.db
      .delete(gitActionPreparations)
      .where(
        sql`CAST(json_extract(${gitActionPreparations.value}, '$.expiresAt') AS INTEGER) < ${cutoff}`,
      )
      .run();
  }
}

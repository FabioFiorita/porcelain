import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gitActionBlocks } from '../db/schema/git-action-blocks.ts';
import { gitActionPreparations } from '../db/schema/git-action-preparations.ts';
import { gitActionReceipts } from '../db/schema/git-action-receipts.ts';
import { GitActionRejectedError } from '../git/errors/git-action-rejected-error.ts';
import type {
  GitActionPreparation,
  GitActionReceipt,
} from '../models/git-action.ts';
import type { GitActionStore } from './interfaces/git-action-store.ts';

export class GitActionRepository implements GitActionStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  savePreparation(value: GitActionPreparation): void {
    this.db.insert(gitActionPreparations).values({ id: value.id, value }).run();
  }
  preparation(id: string): GitActionPreparation | undefined {
    return this.db
      .select()
      .from(gitActionPreparations)
      .where(eq(gitActionPreparations.id, id))
      .get()?.value;
  }
  receipt(id: string): GitActionReceipt | undefined {
    return this.db
      .select()
      .from(gitActionReceipts)
      .where(eq(gitActionReceipts.requestId, id))
      .get()?.value;
  }
  accept(value: GitActionReceipt): {
    receipt: GitActionReceipt;
    created: boolean;
  } {
    return this.db.transaction(
      () => {
        const previous = this.receipt(value.requestId);
        if (previous) {
          if (
            previous.preparationId !== value.preparationId ||
            previous.projectId !== value.projectId ||
            previous.worktreeId !== value.worktreeId ||
            previous.action !== value.action
          )
            throw new GitActionRejectedError('REQUEST_MISMATCH');
          return { receipt: previous, created: false };
        }
        const preparation = this.db
          .select()
          .from(gitActionPreparations)
          .where(eq(gitActionPreparations.id, value.preparationId))
          .get();
        if (!preparation || preparation.consumed)
          throw new GitActionRejectedError('STALE_PREPARATION');
        this.db
          .update(gitActionPreparations)
          .set({ consumed: true })
          .where(eq(gitActionPreparations.id, value.preparationId))
          .run();
        this.db
          .insert(gitActionReceipts)
          .values({ requestId: value.requestId, value })
          .run();
        return { receipt: value, created: true };
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
  blockProject(projectId: string): void {
    this.db
      .insert(gitActionBlocks)
      .values({ projectId })
      .onConflictDoNothing()
      .run();
  }
  isBlocked(projectId: string): boolean {
    if (
      this.db
        .select()
        .from(gitActionBlocks)
        .where(eq(gitActionBlocks.projectId, projectId))
        .get()
    )
      return true;
    return this.db
      .select()
      .from(gitActionReceipts)
      .all()
      .some(
        ({ value }) =>
          value.projectId === projectId &&
          value.reason === 'PROCESS_GROUP_UNCONFIRMED',
      );
  }
  recover(): void {
    this.db.transaction(() => {
      for (const { value } of this.db.select().from(gitActionReceipts).all()) {
        if (value.state === 'running')
          this.finish({
            ...value,
            state: 'indeterminate',
            reason: value.refreshRequired
              ? 'PROCESS_GROUP_UNCONFIRMED'
              : 'OUTCOME_UNKNOWN',
            refreshRequired: true,
            finishedAt: Date.now(),
          });
      }
    });
  }
}

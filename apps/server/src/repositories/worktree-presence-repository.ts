import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
} from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { commentReads } from '../db/schema/comment-reads.ts';
import { commentThreads } from '../db/schema/comment-threads.ts';
import { reviewedFiles } from '../db/schema/reviewed-files.ts';
import { reviewedLayers } from '../db/schema/reviewed-layers.ts';
import { reviews } from '../db/schema/reviews.ts';
import { worktreePresence } from '../db/schema/worktree-presence.ts';
import type { WorktreePresenceStore } from './interfaces/worktree-presence-store.ts';

export class WorktreePresenceRepository implements WorktreePresenceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  record(worktreeId: string, projectId: string): void {
    this.db
      .insert(worktreePresence)
      .values({ worktreeId, projectId, missingSince: null })
      .onConflictDoUpdate({
        target: worktreePresence.worktreeId,
        set: { projectId, missingSince: null },
      })
      .run();
  }

  observe(projectId: string, presentIds: string[], at: string): void {
    this.db.transaction((tx) => {
      if (presentIds.length > 0)
        tx.update(worktreePresence)
          .set({ missingSince: null })
          .where(
            and(
              eq(worktreePresence.projectId, projectId),
              inArray(worktreePresence.worktreeId, presentIds),
            ),
          )
          .run();
      tx.update(worktreePresence)
        .set({ missingSince: at })
        .where(
          and(
            eq(worktreePresence.projectId, projectId),
            isNull(worktreePresence.missingSince),
            presentIds.length > 0
              ? notInArray(worktreePresence.worktreeId, presentIds)
              : undefined,
          ),
        )
        .run();
    });
  }

  expired(before: string): string[] {
    return this.db
      .select({ worktreeId: worktreePresence.worktreeId })
      .from(worktreePresence)
      .where(
        and(
          isNotNull(worktreePresence.missingSince),
          lt(worktreePresence.missingSince, before),
        ),
      )
      .all()
      .map((row) => row.worktreeId);
  }

  collect(worktreeIds: string[]): void {
    if (worktreeIds.length === 0) return;
    this.db.transaction((tx) => {
      tx.delete(commentThreads)
        .where(inArray(commentThreads.worktreeId, worktreeIds))
        .run();
      tx.delete(reviewedFiles)
        .where(inArray(reviewedFiles.worktreeId, worktreeIds))
        .run();
      tx.delete(reviewedLayers)
        .where(inArray(reviewedLayers.worktreeId, worktreeIds))
        .run();
      tx.delete(reviews).where(inArray(reviews.worktreeId, worktreeIds)).run();
      tx.delete(commentReads)
        .where(inArray(commentReads.worktreeId, worktreeIds))
        .run();
      tx.delete(worktreePresence)
        .where(inArray(worktreePresence.worktreeId, worktreeIds))
        .run();
    });
  }
}

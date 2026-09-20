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
import { artifacts } from '../db/schema/artifacts.ts';
import { commentThreads } from '../db/schema/comment-threads.ts';
import { reviewLayerSets } from '../db/schema/review-layer-sets.ts';
import { reviewedFiles } from '../db/schema/reviewed-files.ts';
import { worktreePresence } from '../db/schema/worktree-presence.ts';
import type { WorktreePresenceStore } from './interfaces/worktree-presence-store.ts';

/**
 * When a worktree with review data was first observed to be gone.
 *
 * Only a listing that *succeeded* may say a worktree is missing. A project
 * that could not be listed leaves every one of its rows exactly as it was, so
 * an unplugged disk never starts the clock — and a worktree that reappears
 * after a long outage starts its grace period from that first real absence
 * rather than finishing it.
 */
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
      // Only a row without a clock already running starts one, so the grace
      // period is measured from the first absence rather than the latest.
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
      tx.delete(artifacts)
        .where(inArray(artifacts.worktreeId, worktreeIds))
        .run();
      tx.delete(commentThreads)
        .where(inArray(commentThreads.worktreeId, worktreeIds))
        .run();
      tx.delete(reviewLayerSets)
        .where(inArray(reviewLayerSets.worktreeId, worktreeIds))
        .run();
      tx.delete(reviewedFiles)
        .where(inArray(reviewedFiles.worktreeId, worktreeIds))
        .run();
      // The presence rows go last: while one exists the data is still
      // findable, so a crash mid-collection leaves work to redo, not orphans.
      tx.delete(worktreePresence)
        .where(inArray(worktreePresence.worktreeId, worktreeIds))
        .run();
    });
  }
}

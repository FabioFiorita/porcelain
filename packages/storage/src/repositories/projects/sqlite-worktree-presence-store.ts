import { eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  ProjectKey,
  RemoveWorktreePresenceInput,
  SaveWorktreePresenceInput,
  WorktreePresence,
} from '@porcelain/projects/models';
import type { WorktreePresenceStore } from '@porcelain/projects/ports';
import { worktreePresence } from '../../db/schema/worktree-presence.ts';

type PresenceRow = typeof worktreePresence.$inferSelect;

function presence(row: PresenceRow): WorktreePresence {
  return {
    worktreeId: row.worktreeId,
    projectId: row.projectId,
    missingSince: row.missingSince ?? undefined,
  };
}

export class SqliteWorktreePresenceStore implements WorktreePresenceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(): WorktreePresence[] {
    return this.db.select().from(worktreePresence).all().map(presence);
  }

  read(input: ProjectKey): WorktreePresence[] {
    return this.db
      .select()
      .from(worktreePresence)
      .where(eq(worktreePresence.projectId, input.projectId))
      .all()
      .map(presence);
  }

  save(input: SaveWorktreePresenceInput): void {
    this.db.transaction(
      (tx) => {
        for (const row of input.rows) {
          const values = {
            worktreeId: row.worktreeId,
            projectId: row.projectId,
            missingSince: row.missingSince ?? null,
          };
          tx.insert(worktreePresence)
            .values(values)
            .onConflictDoUpdate({
              target: worktreePresence.worktreeId,
              set: values,
            })
            .run();
        }
      },
      { behavior: 'immediate' },
    );
  }

  remove(input: RemoveWorktreePresenceInput): void {
    this.db.transaction(
      (tx) => {
        tx.delete(worktreePresence)
          .where(inArray(worktreePresence.worktreeId, input.worktreeIds))
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

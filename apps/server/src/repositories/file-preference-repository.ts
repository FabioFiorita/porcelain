import { and, asc, count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { filePreferences } from '../db/schema/file-preferences.ts';
import type { FilePreferenceChange } from '../models/file-preference.ts';
import { FilePreferenceLimitError } from './errors/file-preference-limit-error.ts';
import type { FilePreferenceStore } from './interfaces/file-preference-store.ts';

export class FilePreferenceRepository implements FilePreferenceStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  list(projectId: string) {
    return this.db
      .select({
        path: filePreferences.path,
        pinned: filePreferences.pinned,
        hidden: filePreferences.hidden,
      })
      .from(filePreferences)
      .where(eq(filePreferences.projectId, projectId))
      .orderBy(asc(filePreferences.path))
      .all();
  }
  set(projectId: string, change: FilePreferenceChange): void {
    this.db.transaction(
      (tx) => {
        const scope = eq(filePreferences.projectId, projectId);
        const existing = tx
          .select({ path: filePreferences.path })
          .from(filePreferences)
          .where(and(scope, eq(filePreferences.path, change.path)))
          .get();
        if (!existing) {
          if (!change.value) return;
          const stored = tx
            .select({ total: count() })
            .from(filePreferences)
            .where(scope)
            .get();
          if (stored && stored.total >= 2000)
            throw new FilePreferenceLimitError();
        }

        tx.insert(filePreferences)
          .values({
            projectId,
            path: change.path,
            pinned: false,
            hidden: false,
            [change.flag]: change.value,
          })
          .onConflictDoUpdate({
            target: [filePreferences.projectId, filePreferences.path],
            set: { [change.flag]: change.value },
          })
          .run();
        tx.delete(filePreferences)
          .where(
            and(
              eq(filePreferences.projectId, projectId),
              eq(filePreferences.path, change.path),
              eq(filePreferences.pinned, false),
              eq(filePreferences.hidden, false),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

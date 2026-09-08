import { and, asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { filePreferences } from '../db/schema/file-preferences.ts';
import type { FilePreferenceChange } from '../models/file-preference.ts';
import type { FilePreferenceStore } from './interfaces/file-preference-store.ts';

export class FilePreferenceRepository implements FilePreferenceStore {
  private readonly db: BetterSQLite3Database;
  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }
  list(worktreeId: string) {
    return this.db
      .select({
        path: filePreferences.path,
        pinned: filePreferences.pinned,
        hidden: filePreferences.hidden,
      })
      .from(filePreferences)
      .where(eq(filePreferences.worktreeId, worktreeId))
      .orderBy(asc(filePreferences.path))
      .all();
  }
  set(worktreeId: string, change: FilePreferenceChange): void {
    this.db.transaction((tx) => {
      tx.insert(filePreferences)
        .values({
          worktreeId,
          path: change.path,
          pinned: false,
          hidden: false,
          [change.flag]: change.value,
        })
        .onConflictDoUpdate({
          target: [filePreferences.worktreeId, filePreferences.path],
          set: { [change.flag]: change.value },
        })
        .run();
      tx.delete(filePreferences)
        .where(
          and(
            eq(filePreferences.worktreeId, worktreeId),
            eq(filePreferences.path, change.path),
            eq(filePreferences.pinned, false),
            eq(filePreferences.hidden, false),
          ),
        )
        .run();
    });
  }
}

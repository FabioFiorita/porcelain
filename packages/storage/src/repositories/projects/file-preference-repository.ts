import { and, asc, count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { filePreferences } from '../../db/schema/file-preferences.ts';
import type { FilePreference } from '@porcelain/projects/models';
import type { FilePreferenceStore } from '@porcelain/projects/ports';

const columns = {
  path: filePreferences.path,
  pinned: filePreferences.pinned,
  hidden: filePreferences.hidden,
};

export class FilePreferenceRepository implements FilePreferenceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(projectId: string): FilePreference[] {
    return this.db
      .select(columns)
      .from(filePreferences)
      .where(eq(filePreferences.projectId, projectId))
      .orderBy(asc(filePreferences.path))
      .all();
  }

  find(projectId: string, path: string): FilePreference | undefined {
    return this.db
      .select(columns)
      .from(filePreferences)
      .where(
        and(
          eq(filePreferences.projectId, projectId),
          eq(filePreferences.path, path),
        ),
      )
      .get();
  }

  count(projectId: string): number {
    return (
      this.db
        .select({ total: count() })
        .from(filePreferences)
        .where(eq(filePreferences.projectId, projectId))
        .get()?.total ?? 0
    );
  }

  save(projectId: string, preference: FilePreference): void {
    this.db.transaction(
      (tx) => {
        tx.insert(filePreferences)
          .values({ projectId, ...preference })
          .onConflictDoUpdate({
            target: [filePreferences.projectId, filePreferences.path],
            set: { pinned: preference.pinned, hidden: preference.hidden },
          })
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  remove(projectId: string, path: string): void {
    this.db.transaction(
      (tx) => {
        tx.delete(filePreferences)
          .where(
            and(
              eq(filePreferences.projectId, projectId),
              eq(filePreferences.path, path),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

import { and, asc, count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { projectFilePreferences } from '../../db/schema/project-file-preferences.ts';
import type { FilePreference } from '@porcelain/projects/models';
import type { FilePreferenceStore } from '@porcelain/projects/ports';

const columns = {
  path: projectFilePreferences.path,
  pinned: projectFilePreferences.pinned,
  hidden: projectFilePreferences.hidden,
};

export class SqliteFilePreferenceStore implements FilePreferenceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(projectId: string): FilePreference[] {
    return this.db
      .select(columns)
      .from(projectFilePreferences)
      .where(eq(projectFilePreferences.projectId, projectId))
      .orderBy(asc(projectFilePreferences.path))
      .all();
  }

  find(projectId: string, path: string): FilePreference | undefined {
    return this.db
      .select(columns)
      .from(projectFilePreferences)
      .where(
        and(
          eq(projectFilePreferences.projectId, projectId),
          eq(projectFilePreferences.path, path),
        ),
      )
      .get();
  }

  count(projectId: string): number {
    return (
      this.db
        .select({ total: count() })
        .from(projectFilePreferences)
        .where(eq(projectFilePreferences.projectId, projectId))
        .get()?.total ?? 0
    );
  }

  save(projectId: string, preference: FilePreference): void {
    this.db.transaction(
      (tx) => {
        tx.insert(projectFilePreferences)
          .values({ projectId, ...preference })
          .onConflictDoUpdate({
            target: [
              projectFilePreferences.projectId,
              projectFilePreferences.path,
            ],
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
        tx.delete(projectFilePreferences)
          .where(
            and(
              eq(projectFilePreferences.projectId, projectId),
              eq(projectFilePreferences.path, path),
            ),
          )
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

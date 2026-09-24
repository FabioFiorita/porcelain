import { and, asc, count, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  FilePreference,
  FilePreferenceKey,
  ProjectFilePreference,
  ProjectKey,
} from '@porcelain/projects/models';
import type { FilePreferenceStore } from '@porcelain/projects/ports';
import { projectFilePreferences } from '../../db/schema/project-file-preferences.ts';

const COLUMNS = {
  path: projectFilePreferences.path,
  pinned: projectFilePreferences.pinned,
  hidden: projectFilePreferences.hidden,
};

function keyed(input: FilePreferenceKey) {
  return and(
    eq(projectFilePreferences.projectId, input.projectId),
    eq(projectFilePreferences.path, input.path),
  );
}

export class SqliteFilePreferenceStore implements FilePreferenceStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  list(input: ProjectKey): FilePreference[] {
    return this.db
      .select(COLUMNS)
      .from(projectFilePreferences)
      .where(eq(projectFilePreferences.projectId, input.projectId))
      .orderBy(asc(projectFilePreferences.path))
      .all();
  }

  find(input: FilePreferenceKey): FilePreference | undefined {
    return this.db
      .select(COLUMNS)
      .from(projectFilePreferences)
      .where(keyed(input))
      .get();
  }

  count(input: ProjectKey): number {
    return (
      this.db
        .select({ total: count() })
        .from(projectFilePreferences)
        .where(eq(projectFilePreferences.projectId, input.projectId))
        .get()?.total ?? 0
    );
  }

  save(input: ProjectFilePreference): void {
    const { projectId, preference } = input;
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

  remove(input: FilePreferenceKey): void {
    this.db.transaction(
      (tx) => {
        tx.delete(projectFilePreferences).where(keyed(input)).run();
      },
      { behavior: 'immediate' },
    );
  }
}

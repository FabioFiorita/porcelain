import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  RemoveProjectInput,
  RemoveProjectResult,
} from '@porcelain/projects/models';
import type { ProjectRemovalStore } from '@porcelain/projects/ports';
import { inventoryProjects } from '../../db/schema/inventory-projects.ts';

export class SqliteProjectRemovalStore implements ProjectRemovalStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  remove(input: RemoveProjectInput): RemoveProjectResult {
    const { changes } = this.db.transaction(
      (tx) =>
        tx
          .delete(inventoryProjects)
          .where(eq(inventoryProjects.id, input.projectId))
          .run(),
      { behavior: 'immediate' },
    );
    return { deleted: changes > 0 };
  }
}

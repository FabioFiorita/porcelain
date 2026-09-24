import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type {
  Inventory,
  ProjectKey,
  RegisteredProject,
} from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import { inventoryProjects } from '../../db/schema/inventory-projects.ts';

const COLUMNS = {
  id: inventoryProjects.id,
  name: inventoryProjects.name,
  namedByOwner: inventoryProjects.namedByOwner,
  commonDirectory: inventoryProjects.commonDirectory,
  repositoryIdentity: inventoryProjects.repositoryIdentity,
  available: inventoryProjects.available,
  position: inventoryProjects.position,
};

export class SqliteInventoryStore implements InventoryStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  markAllUnavailable(): void {
    this.db.transaction(
      (tx) => {
        tx.update(inventoryProjects).set({ available: false }).run();
      },
      { behavior: 'immediate' },
    );
  }

  read(): Inventory {
    return {
      projects: this.db
        .select(COLUMNS)
        .from(inventoryProjects)
        .orderBy(asc(inventoryProjects.position))
        .all(),
    };
  }

  find(input: ProjectKey): RegisteredProject | undefined {
    return this.db
      .select(COLUMNS)
      .from(inventoryProjects)
      .where(eq(inventoryProjects.id, input.projectId))
      .get();
  }

  save(input: RegisteredProject): void {
    this.db.transaction(
      (tx) => {
        tx.insert(inventoryProjects)
          .values(input)
          .onConflictDoUpdate({ target: inventoryProjects.id, set: input })
          .run();
      },
      { behavior: 'immediate' },
    );
  }

  remove(input: ProjectKey): void {
    this.db.transaction(
      (tx) => {
        tx.delete(inventoryProjects)
          .where(eq(inventoryProjects.id, input.projectId))
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

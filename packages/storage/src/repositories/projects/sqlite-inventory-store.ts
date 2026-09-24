import { asc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Inventory, RegisteredProject } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import { environment } from '../../db/schema/environment.ts';
import { inventoryProjects } from '../../db/schema/inventory-projects.ts';
import { MissingEnvironmentIdentityError } from '../../models/missing-environment-identity-error.ts';

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
    const environmentId = this.db.select().from(environment).get()?.id;
    if (environmentId === undefined)
      throw new MissingEnvironmentIdentityError();
    return {
      environmentId,
      projects: this.db
        .select({
          id: inventoryProjects.id,
          name: inventoryProjects.name,
          namedByOwner: inventoryProjects.namedByOwner,
          commonDirectory: inventoryProjects.commonDirectory,
          repositoryIdentity: inventoryProjects.repositoryIdentity,
          available: inventoryProjects.available,
          position: inventoryProjects.position,
        })
        .from(inventoryProjects)
        .orderBy(asc(inventoryProjects.position))
        .all(),
    };
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
}

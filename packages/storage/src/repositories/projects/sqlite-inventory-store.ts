import { asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { EnvironmentIdentityStore } from '@porcelain/access/ports';
import type { Inventory, RegisteredProject } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import { inventoryProjects } from '../../db/schema/inventory-projects.ts';
import { MissingEnvironmentIdentityError } from '../../models/missing-environment-identity-error.ts';

export class SqliteInventoryStore implements InventoryStore {
  private readonly db: BetterSQLite3Database;
  private readonly environmentIdentityStore: EnvironmentIdentityStore;

  constructor(
    db: BetterSQLite3Database,
    environmentIdentityStore: EnvironmentIdentityStore,
  ) {
    this.db = db;
    this.environmentIdentityStore = environmentIdentityStore;
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
    const environmentId = this.environmentIdentityStore.environmentId();
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
        })
        .from(inventoryProjects)
        .orderBy(asc(inventoryProjects.position))
        .all(),
    };
  }

  save(project: RegisteredProject): void {
    this.db.transaction(
      (tx) => {
        const existing = tx
          .select({ position: inventoryProjects.position })
          .from(inventoryProjects)
          .where(eq(inventoryProjects.id, project.id))
          .get();
        const position =
          existing?.position ??
          (tx
            .select({ position: max(inventoryProjects.position) })
            .from(inventoryProjects)
            .get()?.position ?? 0) + 1;
        tx.insert(inventoryProjects)
          .values({ ...project, position })
          .onConflictDoUpdate({ target: inventoryProjects.id, set: project })
          .run();
      },
      { behavior: 'immediate' },
    );
  }
}

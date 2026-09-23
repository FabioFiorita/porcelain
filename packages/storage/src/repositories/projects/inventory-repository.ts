import { randomUUID } from 'node:crypto';
import { asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { environments } from '../../db/schema/environments.ts';
import { projects } from '../../db/schema/projects.ts';
import type { RegisteredProject } from '@porcelain/projects/models';
import type { InventoryStore } from '@porcelain/projects/ports';
import { MissingEnvironmentIdentityError } from '../../models/missing-environment-identity-error.ts';

export class InventoryRepository implements InventoryStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
    db.insert(environments)
      .values({ singleton: 1, id: randomUUID() })
      .onConflictDoNothing()
      .run();
  }

  markAllUnavailable(): void {
    this.db.update(projects).set({ available: false }).run();
  }

  read(): { environmentId: string; projects: RegisteredProject[] } {
    return this.db.transaction((tx) => {
      const environment = tx.select().from(environments).get();
      if (!environment) throw new MissingEnvironmentIdentityError();
      return {
        environmentId: environment.id,
        projects: tx
          .select()
          .from(projects)
          .orderBy(asc(projects.position))
          .all()
          .map((project) => ({
            id: project.id,
            name: project.name,
            namedByOwner: project.namedByOwner,
            commonDirectory: project.commonDirectory,
            repositoryIdentity: project.repositoryIdentity,
            available: project.available,
          })),
      };
    });
  }

  save(project: RegisteredProject): void {
    this.db.transaction((tx) => {
      const existing = tx
        .select({ position: projects.position })
        .from(projects)
        .where(eq(projects.id, project.id))
        .get();
      const position =
        existing?.position ??
        (tx
          .select({ position: max(projects.position) })
          .from(projects)
          .get()?.position ?? 0) + 1;
      tx.insert(projects)
        .values({ ...project, position })
        .onConflictDoUpdate({ target: projects.id, set: project })
        .run();
    });
  }
}

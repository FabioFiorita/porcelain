import { randomUUID } from 'node:crypto';
import { asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { environments } from '../db/schema/environments.ts';
import { projects } from '../db/schema/projects.ts';
import type { RegisteredProject } from '../models/project.ts';
import { MissingEnvironmentIdentityError } from './errors/missing-environment-identity-error.ts';
import type { InventoryStore } from './interfaces/inventory-store.ts';

/**
 * The registered projects, and only those.
 *
 * Worktrees are not stored: Git lists them and their ids are derived, so there
 * is no table here for them to drift from. Registering a repository is the one
 * explicit choice, which is why projects stay.
 */
export class InventoryRepository implements InventoryStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
    // The installation's own id, minted once and never again.
    db.insert(environments)
      .values({ singleton: 1, id: randomUUID() })
      .onConflictDoNothing()
      .run();
  }

  /**
   * A project is reachable until a listing says so. Availability is persisted,
   * so a project that was reachable at the last shutdown would otherwise keep
   * reporting so until the first listing answers.
   */
  markAllUnavailable(): void {
    this.db.update(projects).set({ available: false }).run();
  }

  /**
   * Environment and projects, read synchronously.
   *
   * Health and pairing need the environment id, so this must never reach for
   * Git. Live worktree listing is a separate, asynchronous call.
   */
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

import { randomUUID } from 'node:crypto';
import { asc, eq, max } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { environments } from '../db/schema/environments.ts';
import { projects } from '../db/schema/projects.ts';
import { worktrees } from '../db/schema/worktrees.ts';
import type { Inventory } from '../models/inventory.ts';
import type { Project } from '../models/project.ts';
import { MissingEnvironmentIdentityError } from './errors/missing-environment-identity-error.ts';
import type { InventoryStore } from './interfaces/inventory-store.ts';

export class InventoryRepository implements InventoryStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
    db.insert(environments)
      .values({ singleton: 1, id: randomUUID() })
      .onConflictDoNothing()
      .run();
  }

  read(): Inventory {
    return this.db.transaction((tx) => {
      const environment = tx.select().from(environments).get();
      if (!environment) throw new MissingEnvironmentIdentityError();
      const rows = tx
        .select()
        .from(worktrees)
        .orderBy(asc(worktrees.position))
        .all();
      return {
        environmentId: environment.id,
        projects: tx
          .select()
          .from(projects)
          .orderBy(asc(projects.position))
          .all()
          .map(({ position: _position, ...project }) => ({
            ...project,
            worktrees: rows
              .filter((row) => row.projectId === project.id)
              .map(
                ({
                  projectId: _projectId,
                  position: _worktreePosition,
                  ...worktree
                }) => worktree,
              ),
          })),
      };
    });
  }
  save(project: Project): void {
    this.db.transaction((tx) => {
      const { worktrees: checkouts, ...record } = project;
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
        .values({ ...record, position })
        .onConflictDoUpdate({ target: projects.id, set: record })
        .run();
      tx.delete(worktrees).where(eq(worktrees.projectId, project.id)).run();
      if (checkouts.length > 0)
        tx.insert(worktrees)
          .values(
            checkouts.map((worktree, index) => ({
              ...worktree,
              projectId: project.id,
              position: index,
            })),
          )
          .run();
    });
  }
}

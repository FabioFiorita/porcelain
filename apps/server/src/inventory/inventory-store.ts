import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { asc, eq, max } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import type { Inventory, Project } from './inventory.ts';
import { environments, projects, worktrees } from './inventory-schema.ts';

export function openInventoryStore(dataDirectory: string) {
  if (!isAbsolute(dataDirectory))
    throw new Error('An absolute data directory is required');
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(join(dataDirectory, 'inventory.sqlite'));
  const db = drizzle({ client: database });
  try {
    const version = database.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 0 && version !== 1 && version !== 2)
      throw new Error('Unsupported inventory database version');
    database.exec(
      'PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;',
    );
    migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL('../../drizzle/', import.meta.url),
      ),
    });
    db.insert(environments)
      .values({ singleton: 1, id: randomUUID() })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    database.close();
    throw error;
  }
  return {
    read(): Inventory {
      return db.transaction((tx) => {
        const environment = tx.select().from(environments).get();
        if (!environment) throw new Error('Missing environment identity');
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
    },
    save(project: Project): void {
      db.transaction((tx) => {
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
    },
    close(): void {
      database.close();
    },
  };
}

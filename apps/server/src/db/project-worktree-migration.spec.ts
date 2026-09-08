import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { expect, it } from 'vitest';
import { InventoryRepository } from '../repositories/inventory-repository.ts';
import { ProjectRemovalRepository } from '../repositories/project-removal-repository.ts';
import { openDatabase } from './connection.ts';

it('backfills existing worktree ownership so refresh cannot orphan review data before project removal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-ownership-migration-'));
  try {
    const connection = new DatabaseSync(join(root, 'inventory.sqlite'));
    try {
      const migrations = readMigrationFiles({
        migrationsFolder: fileURLToPath(
          new URL('../../drizzle/', import.meta.url),
        ),
      });
      const ownership = migrations.findIndex((migration) =>
        migration.sql.some((sql) =>
          sql.includes('CREATE TABLE `project_worktrees`'),
        ),
      );
      expect(ownership).toBeGreaterThan(0);
      connection.exec(
        'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
      );
      for (const migration of migrations.slice(0, ownership)) {
        for (const statement of migration.sql) connection.exec(statement);
        connection
          .prepare(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          )
          .run(migration.hash, migration.folderMillis);
      }
      connection.exec(
        "INSERT INTO environment VALUES (1, 'environment'); INSERT INTO inventory_projects VALUES ('project', 'Fixture', '/fixture/.git', 'repo', 1, 0); INSERT INTO worktrees VALUES ('worktree', 'project', '/fixture', 'metadata', 1, NULL, 1, 0); INSERT INTO review_layer_sets VALUES ('worktree', 1, '[]');",
      );
    } finally {
      connection.close();
    }
    const database = openDatabase(root);
    try {
      const inventory = new InventoryRepository(database.db);
      const project = inventory.read().projects[0];
      if (!project) throw new Error('Missing migrated project');
      inventory.save({ ...project, worktrees: [] });
      const stored = new DatabaseSync(join(root, 'inventory.sqlite'), {
        readOnly: true,
      });
      try {
        expect(
          stored.prepare('SELECT revision FROM review_layer_sets').all(),
        ).toEqual([{ revision: 1 }]);
        expect(
          new ProjectRemovalRepository(database.db).remove(project.id),
        ).toEqual({ deleted: true });
        expect(stored.prepare('SELECT * FROM review_layer_sets').all()).toEqual(
          [],
        );
      } finally {
        stored.close();
      }
    } finally {
      database.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

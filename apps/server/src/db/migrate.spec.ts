import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { expect, it } from 'vitest';
import { FilePreferenceRepository } from '../repositories/file-preference-repository.ts';
import { InventoryRepository } from '../repositories/inventory-repository.ts';
import { openDatabase } from './connection.ts';

it('adds preference storage to an existing inventory without changing its identities', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-storage-upgrade-'));
  try {
    const migrations = readMigrationFiles({
      migrationsFolder: fileURLToPath(
        new URL('../../drizzle/', import.meta.url),
      ),
    });
    const previous = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      previous.exec(
        'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
      );
      for (const migration of migrations.slice(0, 2)) {
        for (const statement of migration.sql) previous.exec(statement);
        previous
          .prepare(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          )
          .run(migration.hash, migration.folderMillis);
      }
      previous.exec(
        "INSERT INTO environment (singleton, id) VALUES (1, 'environment'); INSERT INTO inventory_projects VALUES ('project', 'Project', '/fixture/.git', 'repo-identity', 0, 0); INSERT INTO worktrees VALUES ('worktree', 'project', '/fixture', 'checkout-identity', 1, NULL, 0, 0);",
      );
    } finally {
      previous.close();
    }
    const upgraded = openDatabase(directory);
    try {
      expect(new InventoryRepository(upgraded.db).read()).toMatchObject({
        environmentId: 'environment',
        projects: [
          {
            id: 'project',
            worktrees: [
              { id: 'worktree', metadataIdentity: 'checkout-identity' },
            ],
          },
        ],
      });
      const preferences = new FilePreferenceRepository(upgraded.db);
      expect(preferences.list('worktree')).toEqual([]);
      preferences.set('worktree', {
        path: 'notes.txt',
        flag: 'pinned',
        value: true,
      });
      expect(preferences.list('worktree')).toEqual([
        { path: 'notes.txt', pinned: true, hidden: false },
      ]);
    } finally {
      upgraded.close();
    }
    // Reopening validates that every applied migration is a supported prefix, not only that SQL ran.
    const reopened = openDatabase(directory);
    reopened.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { expect, it } from 'vitest';
import { FilePreferenceLimitError } from '../repositories/errors/file-preference-limit-error.ts';
import { FilePreferenceRepository } from '../repositories/file-preference-repository.ts';
import { ProjectRemovalRepository } from '../repositories/project-removal-repository.ts';
import { openDatabase } from './connection.ts';

it('merges owned worktree flags without losing over-capacity or unowned intent and removes only the requested project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-project-preferences-'));
  try {
    const connection = new DatabaseSync(join(root, 'inventory.sqlite'));
    try {
      const migrations = readMigrationFiles({
        migrationsFolder: fileURLToPath(
          new URL('../../drizzle/', import.meta.url),
        ),
      });
      const boundary = migrations.findIndex((migration) =>
        migration.sql.some((sql) =>
          sql.includes('CREATE TABLE `project_file_preferences`'),
        ),
      );
      expect(boundary).toBeGreaterThan(0);
      connection.exec(
        'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
      );
      for (const migration of migrations.slice(0, boundary)) {
        for (const statement of migration.sql) connection.exec(statement);
        connection
          .prepare(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          )
          .run(migration.hash, migration.folderMillis);
      }
      connection.exec(`
        INSERT INTO environment VALUES (1, 'environment');
        INSERT INTO inventory_projects VALUES ('project', 'Fixture', '/fixture/.git', 'repo', 1, 0), ('other', 'Other', '/other/.git', 'other-repo', 1, 1);
        INSERT INTO project_worktrees VALUES ('main', 'project'), ('disappeared', 'project'), ('other-main', 'other');
        INSERT INTO file_preferences VALUES ('main', 'shared', 1, 0), ('disappeared', 'shared', 0, 1), ('other-main', 'shared', 0, 1), ('unowned', 'keep', 1, 0);
        WITH RECURSIVE paths(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM paths WHERE n < 2000)
        INSERT INTO file_preferences SELECT CASE WHEN n <= 1000 THEN 'main' ELSE 'disappeared' END, 'file-' || n, 1, 0 FROM paths;
      `);
    } finally {
      connection.close();
    }
    const database = openDatabase(root);
    try {
      const preferences = new FilePreferenceRepository(database.db);
      expect(preferences.list('project')).toHaveLength(2001);
      expect(preferences.list('project')).toContainEqual({
        path: 'shared',
        pinned: true,
        hidden: true,
      });
      expect(preferences.list('other')).toEqual([
        { path: 'shared', pinned: false, hidden: true },
      ]);
      expect(() =>
        preferences.set('project', {
          path: 'new',
          flag: 'pinned',
          value: true,
        }),
      ).toThrow(FilePreferenceLimitError);
      preferences.set('project', {
        path: 'shared',
        flag: 'hidden',
        value: false,
      });
      expect(preferences.list('project')).toContainEqual({
        path: 'shared',
        pinned: true,
        hidden: false,
      });
      preferences.set('project', {
        path: 'file-1',
        flag: 'pinned',
        value: false,
      });
      preferences.set('project', {
        path: 'file-2',
        flag: 'pinned',
        value: false,
      });
      preferences.set('project', { path: 'new', flag: 'hidden', value: true });
      expect(preferences.list('project')).toHaveLength(2000);
      expect(
        new ProjectRemovalRepository(database.db).remove('project'),
      ).toEqual({ deleted: true });
      expect(preferences.list('project')).toEqual([]);
      expect(preferences.list('other')).toEqual([
        { path: 'shared', pinned: false, hidden: true },
      ]);
    } finally {
      database.close();
    }
    const reopened = openDatabase(root);
    try {
      expect(new FilePreferenceRepository(reopened.db).list('other')).toEqual([
        { path: 'shared', pinned: false, hidden: true },
      ]);
      const retained = new DatabaseSync(join(root, 'inventory.sqlite'), {
        readOnly: true,
      });
      try {
        expect(
          retained.prepare('SELECT * FROM file_preferences').all(),
        ).toEqual([
          { worktree_id: 'unowned', path: 'keep', pinned: 1, hidden: 0 },
        ]);
      } finally {
        retained.close();
      }
    } finally {
      reopened.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

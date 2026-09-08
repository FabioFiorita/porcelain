import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { InvalidDataDirectoryError } from '../db/errors/invalid-data-directory-error.ts';
import { UnsupportedDatabaseVersionError } from '../db/errors/unsupported-database-version-error.ts';
import { environments } from '../db/schema/environments.ts';
import { worktrees } from '../db/schema/worktrees.ts';
import type { Project } from '../models/project.ts';
import { MissingEnvironmentIdentityError } from './errors/missing-environment-identity-error.ts';
import { InventoryRepository } from './inventory-repository.ts';

describe('InventoryRepository', () => {
  function openInventoryStore(directory: string) {
    const database = openDatabase(directory);
    try {
      const repository = new InventoryRepository(database.db);
      return {
        read: () => repository.read(),
        save: (project: Project) => repository.save(project),
        close: () => database.close(),
      };
    } catch (error) {
      database.close();
      throw error;
    }
  }

  it('rejects a newer schema without changing its version or data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-schema-'));
    try {
      const path = join(directory, 'inventory.sqlite');
      const database = new DatabaseSync(path);
      database.exec(
        "PRAGMA user_version = 3; CREATE TABLE future (value TEXT); INSERT INTO future VALUES ('preserve');",
      );
      database.close();
      expect(() => openInventoryStore(directory)).toThrow(
        UnsupportedDatabaseVersionError,
      );
      const reopened = new DatabaseSync(path);
      try {
        expect(
          reopened.prepare('PRAGMA user_version').get()?.user_version,
        ).toBe(3);
        expect(reopened.prepare('SELECT value FROM future').get()?.value).toBe(
          'preserve',
        );
      } finally {
        reopened.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('requires an explicit absolute data directory', () => {
    expect(() => openInventoryStore('relative')).toThrow(
      InvalidDataDirectoryError,
    );
  });

  const fixtureProject: Project = {
    id: 'project-original',
    name: 'Atlas',
    commonDirectory: '/fixture/atlas/.git',
    repositoryIdentity: 'repository-original',
    available: false,
    worktrees: [
      {
        id: 'main-original',
        path: '/fixture/atlas',
        metadataIdentity: 'main-metadata',
        main: true,
        branch: 'refs/heads/main',
        available: false,
      },
      {
        id: 'linked-original',
        path: '/fixture/linked',
        metadataIdentity: 'linked-metadata',
        main: false,
        branch: null,
        available: false,
      },
    ],
  };

  it('creates and reopens inventory preserving identities and worktree order', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-reopen-'));
    try {
      const store = openInventoryStore(directory);
      store.save(fixtureProject);
      const inventory = store.read();
      store.close();
      const reopened = openInventoryStore(directory);
      try {
        expect(reopened.read()).toEqual(inventory);
        expect(reopened.read().projects).toEqual([fixtureProject]);
      } finally {
        reopened.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(['future', 'divergent', 'untracked'])(
    'rejects %s migration history without changing the database',
    async (kind) => {
      const directory = await mkdtemp(join(tmpdir(), 'porcelain-history-'));
      try {
        const store = openInventoryStore(directory);
        store.save(fixtureProject);
        store.close();
        const path = join(directory, 'inventory.sqlite');
        const database = new DatabaseSync(path);
        if (kind === 'future')
          database.exec(
            "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('future', 9999999999999)",
          );
        if (kind === 'divergent')
          database.exec("UPDATE __drizzle_migrations SET hash = 'different'");
        if (kind === 'untracked')
          database.exec('DROP TABLE __drizzle_migrations');
        database.close();
        const before = await readFile(path);
        expect(() => openInventoryStore(directory)).toThrow(
          UnsupportedDatabaseVersionError,
        );
        expect(await readFile(path)).toEqual(before);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it('rolls back the complete project update when worktree identities conflict', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-transaction-'));
    try {
      const store = openInventoryStore(directory);
      try {
        store.save(fixtureProject);
        expect(() =>
          store.save({
            ...fixtureProject,
            name: 'Rejected change',
            worktrees: [
              ...fixtureProject.worktrees,
              ...fixtureProject.worktrees,
            ],
          }),
        ).toThrow();
        expect(store.read().projects).toEqual([fixtureProject]);
      } finally {
        store.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('enforces worktree ownership through foreign keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-relations-'));
    try {
      const database = openDatabase(directory);
      try {
        expect(() =>
          database.db
            .insert(worktrees)
            .values({
              id: 'orphan',
              projectId: 'missing-project',
              path: '/fixture',
              metadataIdentity: 'metadata',
              main: true,
              branch: null,
              available: true,
              position: 0,
            })
            .run(),
        ).toThrow();
      } finally {
        database.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reports missing persisted environment identity instead of returning invalid inventory', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'porcelain-missing-environment-'),
    );
    try {
      const database = openDatabase(directory);
      try {
        const repository = new InventoryRepository(database.db);
        database.db.delete(environments).run();
        expect(() => repository.read()).toThrow(
          MissingEnvironmentIdentityError,
        );
      } finally {
        database.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('upgrades baseline inventory preserving known identities and converting missing identities to null', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-upgrade-'));
    try {
      const baseline = readMigrationFiles({
        migrationsFolder: fileURLToPath(
          new URL('../../drizzle/', import.meta.url),
        ),
      })[0];
      if (!baseline) throw new Error('Missing baseline migration fixture');
      const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
      try {
        for (const statement of baseline.sql) database.exec(statement);
        database.exec(
          'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
        );
        database
          .prepare(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          )
          .run(baseline.hash, baseline.folderMillis);
        database
          .prepare('INSERT INTO environment (singleton, id) VALUES (1, ?)')
          .run('environment-original');
        database
          .prepare(
            'INSERT INTO inventory_projects (id, name, common_directory, repository_identity, available, position) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(
            fixtureProject.id,
            fixtureProject.name,
            fixtureProject.commonDirectory,
            fixtureProject.repositoryIdentity,
            0,
            0,
          );
        for (const [position, worktree] of fixtureProject.worktrees.entries()) {
          database
            .prepare(
              'INSERT INTO worktrees (id, project_id, path, metadata_identity, main, branch, available, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            )
            .run(
              worktree.id,
              fixtureProject.id,
              worktree.path,
              position === 0 ? worktree.metadataIdentity : '',
              Number(worktree.main),
              worktree.branch,
              0,
              position,
            );
        }
      } finally {
        database.close();
      }
      const store = openInventoryStore(directory);
      try {
        expect(store.read()).toEqual({
          environmentId: 'environment-original',
          projects: [
            {
              ...fixtureProject,
              worktrees: fixtureProject.worktrees.map((worktree, position) => ({
                ...worktree,
                metadataIdentity:
                  position === 0 ? worktree.metadataIdentity : null,
              })),
            },
          ],
        });
      } finally {
        store.close();
      }
      const reopened = openInventoryStore(directory);
      try {
        const project = {
          ...fixtureProject,
          worktrees: fixtureProject.worktrees.map((worktree) => ({
            ...worktree,
            metadataIdentity: null,
          })),
        };
        reopened.save(project);
        expect(reopened.read().projects).toEqual([project]);
      } finally {
        reopened.close();
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

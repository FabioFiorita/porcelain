import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { InvalidDataDirectoryError } from '../db/errors/invalid-data-directory-error.ts';
import { UnsupportedDatabaseVersionError } from '../db/errors/unsupported-database-version-error.ts';
import { environments } from '../db/schema/environments.ts';
import type { Project } from '../models/project.ts';
import { MissingEnvironmentIdentityError } from './errors/missing-environment-identity-error.ts';
import { InventoryRepository } from './inventory-repository.ts';

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
      expect(reopened.prepare('PRAGMA user_version').get()?.user_version).toBe(
        3,
      );
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

const legacyProject: Project = {
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

function createLegacyDatabase(directory: string, data: string) {
  const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
  database.exec(
    'PRAGMA user_version = 1; CREATE TABLE environment (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), id TEXT NOT NULL); CREATE TABLE projects (id TEXT PRIMARY KEY, repository_identity TEXT NOT NULL UNIQUE, data TEXT NOT NULL);',
  );
  database
    .prepare('INSERT INTO environment VALUES (1, ?)')
    .run('environment-original');
  database
    .prepare('INSERT INTO projects VALUES (?, ?, ?)')
    .run(legacyProject.id, legacyProject.repositoryIdentity, data);
  database.close();
}

it('migrates version-1 JSON records without changing IDs, ordering, branches or availability', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-upgrade-'));
  try {
    createLegacyDatabase(directory, JSON.stringify(legacyProject));
    for (let attempt = 0; attempt < 2; attempt++) {
      const store = openInventoryStore(directory);
      try {
        expect(store.read()).toEqual({
          environmentId: 'environment-original',
          projects: [legacyProject],
        });
      } finally {
        store.close();
      }
    }
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(
        2,
      );
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM worktrees').get()
          ?.count,
      ).toBe(2);
      expect(
        database
          .prepare("SELECT name FROM sqlite_master WHERE name = 'projects'")
          .get(),
      ).toBeUndefined();
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('rolls back an invalid legacy migration and leaves the source inventory recoverable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-upgrade-failure-'));
  try {
    createLegacyDatabase(directory, '{broken');
    expect(() => openInventoryStore(directory)).toThrow();
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(
        1,
      );
      expect(database.prepare('SELECT data FROM projects').get()?.data).toBe(
        '{broken',
      );
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'inventory_projects'",
          )
          .get(),
      ).toBeUndefined();
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('rolls back the complete project update when worktree identities conflict', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-transaction-'));
  try {
    const store = openInventoryStore(directory);
    try {
      store.save(legacyProject);
      expect(() =>
        store.save({
          ...legacyProject,
          name: 'Rejected change',
          worktrees: [...legacyProject.worktrees, ...legacyProject.worktrees],
        }),
      ).toThrow();
      expect(store.read().projects).toEqual([legacyProject]);
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
    const store = openInventoryStore(directory);
    store.close();
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      database.exec('PRAGMA foreign_keys = ON');
      expect(() =>
        database
          .prepare('INSERT INTO worktrees VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(
            'orphan',
            'missing-project',
            '/fixture',
            'metadata',
            1,
            null,
            1,
            0,
          ),
      ).toThrow();
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('rejects a legacy worktree without an ID instead of losing its identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-missing-id-'));
  try {
    createLegacyDatabase(
      directory,
      JSON.stringify({
        ...legacyProject,
        worktrees: legacyProject.worktrees.map((worktree) => ({
          ...worktree,
          id: null,
        })),
      }),
    );
    expect(() => openInventoryStore(directory)).toThrow();
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(
        1,
      );
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
      expect(() => repository.read()).toThrow(MissingEnvironmentIdentityError);
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

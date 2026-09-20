import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { InvalidDataDirectoryError } from '../db/errors/invalid-data-directory-error.ts';
import { UnsupportedDatabaseVersionError } from '../db/errors/unsupported-database-version-error.ts';
import { environments } from '../db/schema/environments.ts';
import { worktreePresence } from '../db/schema/worktree-presence.ts';
import type { RegisteredProject } from '../models/project.ts';
import { MissingEnvironmentIdentityError } from './errors/missing-environment-identity-error.ts';
import { InventoryRepository } from './inventory-repository.ts';

describe('InventoryRepository', () => {
  function openInventoryStore(directory: string) {
    const database = openDatabase(directory);
    try {
      const repository = new InventoryRepository(database.db);
      return {
        read: () => repository.read(),
        save: (project: RegisteredProject) => repository.save(project),
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

  // Only projects are stored: worktrees come from Git, so there is no order or
  // identity here to preserve any more.
  const fixtureProject: RegisteredProject = {
    id: 'project-original',
    name: 'Atlas',
    namedByOwner: false,
    commonDirectory: '/fixture/atlas/.git',
    repositoryIdentity: 'repository-original',
    available: false,
  };

  it('creates and reopens registered projects unchanged', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-reopen-'));
    try {
      const store = openInventoryStore(directory);
      store.save(fixtureProject);
      const second: RegisteredProject = {
        ...fixtureProject,
        id: 'project-second',
        name: 'Beacon',
        namedByOwner: false,
        commonDirectory: '/fixture/beacon/.git',
        repositoryIdentity: 'repository-second',
      };
      store.save(second);
      const inventory = store.read();
      store.close();
      const reopened = openInventoryStore(directory);
      try {
        expect(reopened.read()).toEqual(inventory);
        // Registration order survives a restart.
        expect(reopened.read().projects).toEqual([fixtureProject, second]);
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

  // Review data is owned by a project through the presence table, so removing
  // a project must not leave rows pointing at it.
  it('enforces presence ownership through foreign keys', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'porcelain-relations-'));
    try {
      const database = openDatabase(directory);
      try {
        expect(() =>
          database.db
            .insert(worktreePresence)
            .values({
              worktreeId: 'orphan',
              projectId: 'missing-project',
              missingSince: null,
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
});

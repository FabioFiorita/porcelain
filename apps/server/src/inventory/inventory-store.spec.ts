import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import type { Project } from './inventory.ts';
import { openInventoryStore } from './inventory-store.ts';

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
      'Unsupported inventory database version',
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
    'absolute data directory',
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

it('reopens an RC-created database without replaying its applied migration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'porcelain-rc-upgrade-'));
  try {
    createLegacyDatabase(directory, JSON.stringify(legacyProject));
    const migration = await readFile(
      new URL('../../drizzle/0000_relational-inventory.sql', import.meta.url),
      'utf8',
    );
    const database = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      database.exec(migration);
      database.exec(
        'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC, name TEXT, applied_at TEXT)',
      );
      database
        .prepare(
          'INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at) VALUES (?, ?, ?, ?)',
        )
        .run(
          createHash('sha256').update(migration).digest('hex'),
          Date.UTC(2026, 8, 7, 22, 15, 37),
          '20260907221537_relational-inventory',
          '2026-09-07T22:15:37.000Z',
        );
    } finally {
      database.close();
    }
    const store = openInventoryStore(directory);
    try {
      expect(store.read()).toEqual({
        environmentId: 'environment-original',
        projects: [legacyProject],
      });
      store.save({ ...legacyProject, name: 'Updated' });
      expect(store.read().projects[0]?.name).toBe('Updated');
      const inspected = new DatabaseSync(join(directory, 'inventory.sqlite'));
      try {
        const indexes = inspected
          .prepare("PRAGMA index_list('inventory_projects')")
          .all();
        expect(
          indexes.some(
            (index) =>
              index.name === 'inventory_projects_repository_identity_unique',
          ),
        ).toBe(true);
        expect(indexes.some((index) => index.origin === 'u')).toBe(false);
        expect(inspected.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      } finally {
        inspected.close();
      }
    } finally {
      store.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

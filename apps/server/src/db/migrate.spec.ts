import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { expect, it } from 'vitest';
import { CommentRepository } from '../repositories/comment-repository.ts';
import { FilePreferenceRepository } from '../repositories/file-preference-repository.ts';
import { InventoryRepository } from '../repositories/inventory-repository.ts';
import { ReviewLayerRepository } from '../repositories/review-layer-repository.ts';
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

it.each([3, 4, 5])(
  'preserves inventory and review metadata when upgrading from migration prefix %i',
  async (prefix) => {
    const directory = await mkdtemp(
      join(tmpdir(), 'porcelain-storage-upgrade-'),
    );
    try {
      const migrations = readMigrationFiles({
        migrationsFolder: fileURLToPath(
          new URL('../../drizzle/', import.meta.url),
        ),
      });
      const discussion = {
        id: 'discussion',
        worktreeId: 'worktree',
        anchor: { kind: 'file', filePath: 'notes.txt' },
        messages: [{ id: 'message', body: 'Keep this discussion' }],
        resolved: false,
      };
      const previous = new DatabaseSync(join(directory, 'inventory.sqlite'));
      try {
        previous.exec(
          'CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)',
        );
        for (const migration of migrations.slice(0, prefix)) {
          for (const statement of migration.sql) previous.exec(statement);
          previous
            .prepare(
              'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
            )
            .run(migration.hash, migration.folderMillis);
        }
        previous.exec(
          "INSERT INTO environment (singleton, id) VALUES (1, 'environment'); INSERT INTO inventory_projects VALUES ('project', 'Project', '/fixture/.git', 'repo-identity', 0, 0); INSERT INTO worktrees VALUES ('worktree', 'project', '/fixture', 'checkout-identity', 1, NULL, 0, 0); INSERT INTO file_preferences VALUES ('worktree', 'notes.txt', 1, 1)",
        );
        if (prefix >= 4)
          previous
            .prepare(
              'INSERT INTO comment_threads (id, worktree_id, data) VALUES (?, ?, ?)',
            )
            .run(
              discussion.id,
              discussion.worktreeId,
              JSON.stringify(discussion),
            );
        if (prefix === 5)
          previous
            .prepare(
              'INSERT INTO review_layer_sets (worktree_id, revision, layers) VALUES (?, ?, ?)',
            )
            .run(
              'worktree',
              7,
              JSON.stringify([
                {
                  id: 'layer',
                  title: 'Retained order',
                  files: [{ path: 'notes.txt', scope: 'unstaged' }],
                },
              ]),
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
        expect(
          new FilePreferenceRepository(upgraded.db).list('worktree'),
        ).toEqual([{ path: 'notes.txt', pinned: true, hidden: true }]);
        if (prefix >= 4)
          expect(new CommentRepository(upgraded.db).list('worktree')).toEqual([
            discussion,
          ]);
        if (prefix === 5)
          expect(
            new ReviewLayerRepository(upgraded.db).read('worktree'),
          ).toEqual({
            worktreeId: 'worktree',
            revision: 7,
            layers: [
              {
                id: 'layer',
                title: 'Retained order',
                files: [{ path: 'notes.txt', scope: 'unstaged' }],
              },
            ],
          });
      } finally {
        upgraded.close();
      }
      // Reopening validates that every applied migration is a supported prefix, not only that SQL ran.
      const reopened = openDatabase(directory);
      reopened.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

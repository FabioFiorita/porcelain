import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, onTestFinished } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { gitActionBlocks } from '../db/schema/git-action-blocks.ts';
import { gitActionReceipts } from '../db/schema/git-action-receipts.ts';
import { reviewedFiles } from '../db/schema/reviewed-files.ts';
import { reviews } from '../db/schema/reviews.ts';
import { worktreePresence } from '../db/schema/worktree-presence.ts';
import type { RegisteredProject } from '../models/project.ts';
import { InventoryRepository } from './inventory-repository.ts';
import { ProjectRemovalRepository } from './project-removal-repository.ts';

const project: RegisteredProject = {
  id: 'project',
  name: 'Fixture',
  namedByOwner: false,
  commonDirectory: '/fixture/.git',
  repositoryIdentity: 'fixture',
  available: false,
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-remove-store-'));
  const database = openDatabase(root);
  onTestFinished(async () => {
    database.close();
    await rm(root, { recursive: true, force: true });
  });
  const inventory = new InventoryRepository(database.db);
  inventory.save(project);
  // Writing review data records the worktree's presence, which is what ties
  // it to a project now that no table copies Git's list.
  database.db
    .insert(worktreePresence)
    .values({
      worktreeId: 'worktree',
      projectId: project.id,
      missingSince: null,
    })
    .run();
  database.db
    .insert(reviews)
    .values({
      worktreeId: 'worktree',
      revision: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      summaryHtml: '<title>Review</title>',
      summaryToken: 'summary',
      summarySecret: 'secret',
      layers: [],
    })
    .run();
  database.db
    .insert(reviewedFiles)
    .values({
      worktreeId: 'worktree',
      path: 'notes.txt',
      fingerprint: 'a'.repeat(64),
      reviewedAt: '2026-01-01T00:00:00.000Z',
    })
    .run();
  return {
    root,
    database,
    inventory,
    store: new ProjectRemovalRepository(database.db),
  };
}

describe('Project removal persistence', () => {
  it.each(['running', 'indeterminate', 'block'] as const)(
    'removes the project and its records when a Git operation is %s',
    async (state) => {
      const { database, inventory, store } = await fixture();
      if (state === 'block')
        database.db
          .insert(gitActionBlocks)
          .values({ projectId: project.id })
          .run();
      else
        database.db
          .insert(gitActionReceipts)
          .values({
            requestId: 'request',
            value: {
              requestId: 'request',
              preparationId: 'preparation',
              projectId: project.id,
              worktreeId: 'worktree',
              action: 'commit',
              state,
              refreshRequired: true,
              acceptedAt: 1,
            },
          })
          .run();
      // Removal touches no disk and the repository can be added again, so an
      // action that ended without a confirmed outcome must not leave a
      // project nobody can ever remove. Its latch goes with it: the table
      // still refuses actions, but not for a project that no longer exists.
      expect(store.remove(project.id)).toEqual({ deleted: true });
      expect(inventory.read().projects).toEqual([]);
      expect(database.db.select().from(reviews).all()).toEqual([]);
      expect(database.db.select().from(reviewedFiles).all()).toEqual([]);
      expect(database.db.select().from(gitActionBlocks).all()).toEqual([]);
      expect(database.db.select().from(gitActionReceipts).all()).toEqual([]);
    },
  );

  it('rolls back review-data deletion if deleting inventory fails', async () => {
    const { root, database, inventory, store } = await fixture();
    const connection = new DatabaseSync(join(root, 'inventory.sqlite'));
    try {
      connection.exec(
        "CREATE TRIGGER reject_removal BEFORE DELETE ON inventory_projects BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
      );
      expect(() => store.remove(project.id)).toThrow('fixture failure');
      expect(inventory.read().projects).toEqual([project]);
      expect(database.db.select().from(reviews).all()).toMatchObject([
        { summaryHtml: '<title>Review</title>' },
      ]);
      expect(database.db.select().from(reviewedFiles).all()).toHaveLength(1);
      connection.exec('DROP TRIGGER reject_removal');
      expect(store.remove(project.id)).toEqual({ deleted: true });
      expect(database.db.select().from(reviews).all()).toEqual([]);
      expect(database.db.select().from(reviewedFiles).all()).toEqual([]);
    } finally {
      connection.close();
    }
  });
});

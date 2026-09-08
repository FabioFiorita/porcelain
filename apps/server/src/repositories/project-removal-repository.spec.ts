import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, onTestFinished } from 'vitest';
import { openDatabase } from '../db/connection.ts';
import { artifacts } from '../db/schema/artifacts.ts';
import { gitActionBlocks } from '../db/schema/git-action-blocks.ts';
import { gitActionReceipts } from '../db/schema/git-action-receipts.ts';
import type { Project } from '../models/project.ts';
import { ProjectRemovalBlockedError } from './errors/project-removal-blocked-error.ts';
import { InventoryRepository } from './inventory-repository.ts';
import { ProjectRemovalRepository } from './project-removal-repository.ts';

const project: Project = {
  id: 'project',
  name: 'Fixture',
  commonDirectory: '/fixture/.git',
  repositoryIdentity: 'fixture',
  available: false,
  worktrees: [
    {
      id: 'worktree',
      path: '/fixture',
      metadataIdentity: 'fixture-main',
      main: true,
      branch: null,
      available: false,
    },
  ],
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
  database.db
    .insert(artifacts)
    .values({
      id: 'artifact',
      worktreeId: 'worktree',
      name: 'Review',
      content: 'data',
      sizeBytes: 4,
      createdAt: '2026-01-01',
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
    'preserves the project and its data when a Git operation is %s',
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
      expect(() => store.remove(project.id)).toThrow(
        ProjectRemovalBlockedError,
      );
      expect(inventory.read().projects).toEqual([project]);
      expect(database.db.select().from(artifacts).all()).toMatchObject([
        { content: 'data' },
      ]);
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
      expect(database.db.select().from(artifacts).all()).toMatchObject([
        { content: 'data' },
      ]);
      connection.exec('DROP TRIGGER reject_removal');
      expect(store.remove(project.id)).toEqual({ deleted: true });
      expect(database.db.select().from(artifacts).all()).toEqual([]);
    } finally {
      connection.close();
    }
  });
});

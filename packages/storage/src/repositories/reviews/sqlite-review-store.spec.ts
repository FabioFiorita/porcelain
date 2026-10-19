import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { ReviewedLayerStore, ReviewStore } from '@porcelain/reviews/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  reviewStoreContract,
  reviewFixture,
  reviewSave,
} from '@porcelain/reviews/store-contracts';

async function openStore(worktreeIds: readonly string[]) {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  await Effect.runPromise(
    (await session.runPromise(InventoryStore)).save({
      id: 'project',
      name: 'project',
      namedByOwner: false,
      commonDirectory: '/repositories/project/.git',
      repositoryIdentity: 'identity-project',
      available: true,
      position: 1,
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(WorktreePresenceStore)).save({
      rows: worktreeIds.map((worktreeId) => ({
        worktreeId,
        projectId: 'project',
        missingSince: undefined,
      })),
    }),
  );
  return {
    dataDirectory,
    store: await session.runPromise(ReviewStore),
    reviewedLayers: await session.runPromise(ReviewedLayerStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
}

reviewStoreContract('SqliteReviewStore', openStore);

it('retains a review and all revisions after worktree and project removal', async () => {
  const first = reviewFixture();
  const opened = await openStore([first.worktreeId]);
  const database = new DatabaseSync(
    join(opened.dataDirectory, 'inventory.sqlite'),
  );
  try {
    await Effect.runPromise(opened.store.save(reviewSave(first)));
    database.exec('PRAGMA foreign_keys = ON');
    database
      .prepare('DELETE FROM inventory_projects WHERE id = ?')
      .run(first.projectId);
    expect(
      await Effect.runPromise(
        opened.store.read({ reviewId: first.reviewId, revision: 1 }),
      ),
    ).toEqual(first);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  } finally {
    database.close();
    await opened.close();
  }
});

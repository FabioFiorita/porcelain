import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { ReviewStore } from '@porcelain/reviews/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import legacy from '../../../spec/fixtures/legacy-review.json' with { type: 'json' };
import { reviewStoreContract } from '@porcelain/reviews/store-contracts';

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
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
}

reviewStoreContract('SqliteReviewStore', openStore);

it('loads a stored review from the old diagram contract and discards removed fields without inventing decision markers', async () => {
  const opened = await openStore([legacy.worktreeId]);
  try {
    const database = new DatabaseSync(
      join(opened.dataDirectory, 'inventory.sqlite'),
    );
    try {
      database
        .prepare(
          'INSERT INTO reviews (worktree_id, revision, published_at, active, summary_html, summary_token, summary_secret, diagram, layers, proof) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        )
        .run(
          legacy.worktreeId,
          legacy.revision,
          legacy.publishedAt,
          1,
          legacy.summaryHtml,
          legacy.summaryToken,
          legacy.summarySecret,
          JSON.stringify(legacy.diagram),
          JSON.stringify(legacy.layers),
        );
    } finally {
      database.close();
    }
    const expected = {
      ...legacy,
      layers: [
        {
          id: 'layer',
          title: 'Introduce delivery',
          summary: 'Own delivery',
          lanes: ['Server'],
          steps: [
            {
              id: 'step',
              lane: 0,
              title: 'Deliver',
              text: 'Own retries',
              kind: 'changed',
              pointer: { path: 'outbox.ts', startLine: 1, endLine: 1 },
              published: ['deliver()'],
            },
          ],
          fingerprint: 'fingerprint',
        },
      ],
      diagram: {
        after: {
          boxes: [
            {
              id: 'decision',
              label: 'Introduce delivery',
              layerId: 'layer',
              change: 'changed',
            },
            {
              id: 'outbox',
              label: 'Delivery outbox',
              layerId: 'layer',
              change: 'new',
            },
          ],
          arrows: [{ from: 'decision', to: 'outbox', label: 'uses' }],
        },
      },
    };
    expect(
      await Effect.runPromise(
        opened.store.read({ worktreeId: legacy.worktreeId }),
      ),
    ).toEqual(expected);
    expect(
      await Effect.runPromise(
        opened.store.byWorktrees({ worktreeIds: [legacy.worktreeId] }),
      ),
    ).toEqual([expected]);
  } finally {
    await opened.close();
  }
});

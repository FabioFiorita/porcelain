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
    reviewedLayers: await session.runPromise(ReviewedLayerStore),
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

async function seededRemoval() {
  const opened = await openStore(['one', 'two']);
  for (const worktreeId of ['one', 'two'])
    await Effect.runPromise(
      opened.store.save({
        worktreeId,
        revision: 4,
        publishedAt: '2026-10-11T10:00:00.000Z',
        active: true,
        summaryHtml: '<p>Review</p>',
        summaryToken: `token-${worktreeId}`,
        summarySecret: 'secret',
        layers: [],
        proofFiles: [
          {
            id: 'proof',
            mediaType: 'image/png',
            bytes: new Uint8Array([1, 2, 3]),
          },
        ],
      }),
    );
  const database = new DatabaseSync(
    join(opened.dataDirectory, 'inventory.sqlite'),
  );
  database.exec('PRAGMA foreign_keys = ON');
  for (const worktreeId of ['one', 'two']) {
    database
      .prepare(
        'INSERT INTO reviewed_layers (worktree_id, layer_id, fingerprint, reviewed_at) VALUES (?, ?, ?, ?)',
      )
      .run(worktreeId, 'layer', 'fingerprint', 'today');
    database
      .prepare(
        'INSERT INTO reviewed_files (worktree_id, scope, branch, path, fingerprint, reviewed_at, stale) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        worktreeId,
        'worktree',
        '',
        'README.md',
        'file-fingerprint',
        'today',
        0,
      );
    database
      .prepare(
        'INSERT INTO comment_threads (id, worktree_id, anchor, resolved, revision, size_bytes) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        `thread-${worktreeId}`,
        worktreeId,
        JSON.stringify({ kind: 'file', filePath: 'README.md' }),
        0,
        1,
        5,
      );
  }
  return {
    ...opened,
    database,
    close: async () => {
      database.close();
      await opened.close();
    },
  };
}

it('removes only the selected review, proof and reviewed layers, keeping comments and reviewed files, and returns false on repetition', async () => {
  const opened = await seededRemoval();
  try {
    expect(
      await Effect.runPromise(opened.store.remove({ worktreeId: 'one' })),
    ).toBe(true);
    expect(
      await Effect.runPromise(opened.store.read({ worktreeId: 'one' })),
    ).toBeUndefined();
    expect(
      await Effect.runPromise(opened.store.findSummary({ token: 'token-one' })),
    ).toBeUndefined();
    expect(
      await Effect.runPromise(
        opened.store.readProofFile({ worktreeId: 'one', proofId: 'proof' }),
      ),
    ).toBeUndefined();
    expect(
      opened.database
        .prepare(
          'SELECT worktree_id, layer_id FROM reviewed_layers ORDER BY worktree_id',
        )
        .all(),
    ).toEqual([{ worktree_id: 'two', layer_id: 'layer' }]);
    expect(
      opened.database
        .prepare(
          'SELECT id, worktree_id FROM comment_threads ORDER BY worktree_id',
        )
        .all(),
    ).toEqual([
      { id: 'thread-one', worktree_id: 'one' },
      { id: 'thread-two', worktree_id: 'two' },
    ]);
    expect(
      opened.database
        .prepare(
          'SELECT worktree_id, path FROM reviewed_files ORDER BY worktree_id',
        )
        .all(),
    ).toEqual([
      { worktree_id: 'one', path: 'README.md' },
      { worktree_id: 'two', path: 'README.md' },
    ]);
    expect(
      await Effect.runPromise(opened.store.read({ worktreeId: 'two' })),
    ).toMatchObject({ revision: 4, summaryToken: 'token-two', active: true });
    expect(
      await Effect.runPromise(
        opened.store.readProofFile({ worktreeId: 'two', proofId: 'proof' }),
      ),
    ).toEqual({
      id: 'proof',
      mediaType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(
      await Effect.runPromise(opened.store.remove({ worktreeId: 'one' })),
    ).toBe(false);
  } finally {
    await opened.close();
  }
});

it('rolls back the review and proof deletion if removing the reviewed layers fails', async () => {
  const opened = await seededRemoval();
  try {
    opened.database.exec(
      "CREATE TRIGGER refuse_layer_delete BEFORE DELETE ON reviewed_layers BEGIN SELECT RAISE(ABORT, 'layer deletion failed'); END",
    );
    await expect(
      Effect.runPromise(opened.store.remove({ worktreeId: 'one' })),
    ).rejects.toThrow();
    expect(
      await Effect.runPromise(opened.store.read({ worktreeId: 'one' })),
    ).toMatchObject({ revision: 4, summaryToken: 'token-one' });
    expect(
      await Effect.runPromise(
        opened.store.readProofFile({ worktreeId: 'one', proofId: 'proof' }),
      ),
    ).toEqual({
      id: 'proof',
      mediaType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(
      opened.database
        .prepare('SELECT layer_id FROM reviewed_layers WHERE worktree_id = ?')
        .all('one'),
    ).toEqual([{ layer_id: 'layer' }]);
  } finally {
    await opened.close();
  }
});

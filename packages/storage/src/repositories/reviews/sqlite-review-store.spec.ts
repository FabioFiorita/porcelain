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

it('reports a conflicting PR identity without losing either review or its branch identity', async () => {
  const first = reviewFixture();
  const opened = await openStore([first.worktreeId]);
  const url = 'https://github.com/example/project/pull/42';
  const other = reviewFixture({
    reviewId: '10000000-0000-4000-8000-000000000002',
    branch: 'another',
    summaryToken: 'summary-other',
  });
  try {
    await Effect.runPromise(
      opened.store.save(reviewSave(first, { pullRequest: url })),
    );
    await Effect.runPromise(opened.store.save(reviewSave(other)));
    expect(
      await Effect.runPromise(
        opened.store
          .setPullRequest({ reviewId: other.reviewId, pullRequest: url })
          .pipe(Effect.flip),
      ),
    ).toMatchObject({ _tag: 'ReviewPullRequestRefusedError' });
    expect(
      await Effect.runPromise(opened.store.readRecord(other)),
    ).toMatchObject({ branch: 'another', state: 'open', latestRevision: 1 });
    expect(
      await Effect.runPromise(opened.store.readRecord(first)),
    ).toMatchObject({ pullRequest: url });
    expect(await Effect.runPromise(opened.store.read(other))).toEqual(other);
  } finally {
    await opened.close();
  }
});

it('upgrades legacy unassigned coverage to a neutral ownerless gap before reading retained reviews', async () => {
  const first = reviewFixture();
  const opened = await openStore([first.worktreeId]);
  const next = ManagedRuntime.make(
    storageLayer(opened.dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  try {
    await Effect.runPromise(opened.store.save(reviewSave(first)));
    const database = new DatabaseSync(
      join(opened.dataDirectory, 'inventory.sqlite'),
    );
    database.prepare('UPDATE review_revisions SET verdict = ?').run(
      JSON.stringify({
        ...first.verdict,
        coverage: [
          {
            asked: 'Chat request',
            built: 'Partial change',
            left: { what: 'Later', owner: { kind: 'nobody' } },
          },
        ],
      }),
    );
    database.exec(
      `DROP TABLE walkthrough_messages; DROP TABLE walkthrough_default_writer; DROP TABLE walkthrough_automatic; DROP TABLE walkthrough_pull_titles; DROP TABLE walkthrough_settings; DROP TABLE walkthrough_evidence; DROP TABLE walkthrough_runs; ALTER TABLE review_revisions DROP COLUMN timing; DELETE FROM porcelain_migrations WHERE migration_id >= 10;`,
    );
    database.close();
    const store = await next.runPromise(ReviewStore);
    const review = await Effect.runPromise(
      store.read({ reviewId: first.reviewId }),
    );
    expect(review?.verdict.coverage).toEqual([
      {
        asked: 'Chat request',
        built: 'Partial change',
        left: { what: 'Later' },
      },
    ]);
  } finally {
    await next.dispose();
    await opened.close();
  }
});

it('retains publication timing independently for each immutable revision', async () => {
  const first = reviewFixture({ timing: 'decision' });
  const second = {
    ...first,
    revision: 2,
    timing: 'record' as const,
    summaryToken: 'second-summary',
  };
  const opened = await openStore([first.worktreeId]);
  try {
    await Effect.runPromise(opened.store.save(reviewSave(first)));
    await Effect.runPromise(opened.store.save(reviewSave(second)));
    expect(
      (
        await Effect.runPromise(
          opened.store.read({ reviewId: first.reviewId, revision: 1 }),
        )
      )?.timing,
    ).toBe('decision');
    expect(
      (await Effect.runPromise(opened.store.read({ reviewId: first.reviewId })))
        ?.timing,
    ).toBe('record');
  } finally {
    await opened.close();
  }
});

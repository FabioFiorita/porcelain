import { ReviewStore } from '@porcelain/reviews/ports';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { reviewFixture, reviewSave } from '@porcelain/reviews/store-contracts';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { NodeServices } from '@effect/platform-node';
import { expect, it } from 'vitest';
import { storageLayer } from '@porcelain/storage';
import { WalkthroughStore } from '@porcelain/walkthroughs/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import {
  restoreWalkthroughMigration012,
  restorePreWalkthroughReview,
  seedStoredWalkthroughs,
} from './walkthrough-fixture.ts';

const legacy: WalkthroughJob = {
  worktreePath: '/fixture',
  files: [],
  run: {
    id: 'legacy',
    projectId: 'project',
    worktreeId: 'worktree',
    headOid: 'head',
    baseOid: 'base',
    pullRequestNumber: 42,
    writer: { provider: 'claude', model: 'claude-opus-5-5', effort: 'high' },
    createdAt: '2026-11-09T00:00:00.000Z',
    state: { status: 'queued' },
  },
};
it('upgrades migration 012 runs to the saved high effort and preserves existing conversation messages in migration 013', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'walkthrough-writer-migration-'),
  );
  const open = () =>
    ManagedRuntime.make(
      storageLayer(directory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
  let runtime = open();
  try {
    const store = await runtime.runPromise(WalkthroughStore);
    await runtime.runPromise(store.accept(legacy));
    await runtime.runPromise(
      store.addMessage({
        id: 'legacy-comment',
        runId: 'legacy',
        worktreeId: 'worktree',
        stopTitle: undefined,
        text: 'Keep this question',
        createdAt: '2026-11-09T00:00:00.000Z',
        post: { status: 'saved' },
        answer: { status: 'answering' },
      }),
    );
    await runtime.runPromise(
      store.saveForLater('worktree', 'legacy-comment', true),
    );
    await runtime.dispose();
    restoreWalkthroughMigration012(directory);
    runtime = open();
    const reopened = await runtime.runPromise(WalkthroughStore);
    expect(
      (await runtime.runPromise(reopened.readJob('legacy')))?.run.writer,
    ).toEqual({ provider: 'claude', model: 'claude-opus-5-5', effort: 'high' });
    expect(
      await runtime.runPromise(
        reopened.readMessage('worktree', 'legacy-comment'),
      ),
    ).toEqual({
      id: 'legacy-comment',
      runId: 'legacy',
      worktreeId: 'worktree',
      stopTitle: undefined,
      text: 'Keep this question',
      createdAt: '2026-11-09T00:00:00.000Z',
      post: { status: 'saved' },
      answer: { status: 'answering' },
      writer: undefined,
    });
    const after = new DatabaseSync(join(directory, 'inventory.sqlite'));
    try {
      expect(
        after
          .prepare(
            'SELECT migration_id,name FROM porcelain_migrations WHERE migration_id >= 12 ORDER BY migration_id',
          )
          .all(),
      ).toEqual([
        { migration_id: 12, name: 'walkthrough_messages' },
        { migration_id: 13, name: 'automatic_walkthroughs' },
        { migration_id: 14, name: 'retire_review_push_kinds' },
      ]);
    } finally {
      after.close();
    }
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('rolls back every seeded row when a stored fixture cannot be committed', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'walkthrough-fixture-atomic-'));
  const runtime = ManagedRuntime.make(
    storageLayer(directory, { worktreeIdLength: 32, busyTimeoutMs: 5000 }).pipe(
      Layer.provide(NodeServices.layer),
    ),
  );
  try {
    await runtime.runPromise(WalkthroughStore);
    const asset = {
      runId: 'legacy',
      id: 'duplicate',
      mediaType: 'image/png',
      caption: 'Fixture',
      bytes: new Uint8Array([1]),
    };
    expect(() =>
      seedStoredWalkthroughs(directory, {
        jobs: [legacy],
        assets: [asset, asset],
      }),
    ).toThrow();
    const store = await runtime.runPromise(WalkthroughStore);
    expect(await runtime.runPromise(store.readJob('legacy'))).toBeUndefined();
    expect(
      await runtime.runPromise(
        store.readAsset('legacy', 'duplicate', 'worktree'),
      ),
    ).toBeUndefined();
  } finally {
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('upgrades legacy unassigned coverage to a neutral ownerless gap before reading retained reviews', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pre-walkthrough-review-'));
  const open = () =>
    ManagedRuntime.make(
      storageLayer(directory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
  let runtime = open();
  const first = reviewFixture();
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        yield* (yield* InventoryStore).save({
          id: 'project',
          name: 'project',
          namedByOwner: false,
          commonDirectory: '/repositories/project/.git',
          repositoryIdentity: 'identity-project',
          available: true,
          position: 1,
        });
        yield* (yield* WorktreePresenceStore).save({
          rows: [
            {
              worktreeId: first.worktreeId,
              projectId: 'project',
              missingSince: undefined,
            },
          ],
        });
        yield* (yield* ReviewStore).save(reviewSave(first));
      }),
    );
    await runtime.dispose();
    restorePreWalkthroughReview(
      directory,
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
    runtime = open();
    const store = await runtime.runPromise(ReviewStore);
    const review = await runtime.runPromise(
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
    await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

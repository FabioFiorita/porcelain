import { temporaryRoot } from '@porcelain/kernel/test-kit/temporary-root';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { AcceptGitActionService } from '@porcelain/git-actions/services';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import { gitActionReceiptStoreContract } from '@porcelain/git-actions/store-contracts';

async function openScoped(projectId: string, worktreeIds: readonly string[]) {
  const dataDirectory = mkdtempSync(join(temporaryRoot, 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  await Effect.runPromise(
    (await session.runPromise(InventoryStore)).save({
      id: projectId,
      name: projectId,
      namedByOwner: false,
      commonDirectory: `/repositories/${projectId}/.git`,
      repositoryIdentity: `identity-${projectId}`,
      available: true,
      position: 1,
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(WorktreePresenceStore)).save({
      rows: worktreeIds.map((worktreeId) => ({
        worktreeId,
        projectId,
        missingSince: undefined,
      })),
    }),
  );
  return {
    session,
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
}

gitActionReceiptStoreContract(
  'SqliteGitActionReceiptStore',
  async ({ projectId, worktreeIds }) => {
    const { session, close } = await openScoped(projectId, worktreeIds);
    return { store: await session.runPromise(GitActionReceiptStore), close };
  },
);

function receipt(requestId: string, worktreeId: string): GitActionReceipt {
  return {
    requestId,
    projectId: 'project',
    worktreeId,
    action: 'fetch',
    intent: { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
    expected: {},
    state: 'interrupted',
    reason: 'OUTCOME_UNKNOWN',
    progress: [],
    refreshRequired: true,
    acceptedAt: '2026-09-23T09:00:00.000Z',
    finishedAt: '2026-09-23T10:00:00.000Z',
  };
}

it('accepts a request ID only once across two repositories and keeps exactly one execution claim', async ({
  onTestFinished,
}) => {
  const { session, close } = await openScoped('project', ['first']);
  onTestFinished(close);
  await session.runPromise(
    Effect.gen(function* () {
      yield* (yield* InventoryStore).save({
        id: 'other-project',
        name: 'Other project',
        namedByOwner: false,
        commonDirectory: '/repositories/other-project/.git',
        repositoryIdentity: 'other-identity',
        available: true,
        position: 2,
      });
      yield* (yield* WorktreePresenceStore).save({
        rows: [
          {
            worktreeId: 'second',
            projectId: 'other-project',
            missingSince: undefined,
          },
        ],
      });
    }),
  );
  const store = await session.runPromise(GitActionReceiptStore);
  const bothReads = Promise.withResolvers<void>();
  let missingReads = 0;
  const gatedStore = GitActionReceiptStore.of({
    ...store,
    read: (input) =>
      store.read(input).pipe(
        Effect.tap((previous) =>
          previous === undefined
            ? Effect.promise(() => {
                missingReads += 1;
                if (missingReads === 2) bothReads.resolve();
                return bothReads.promise;
              })
            : Effect.void,
        ),
      ),
  });
  const accept = await Effect.runPromise(
    AcceptGitActionService.pipe(
      Effect.provide(AcceptGitActionService.layer),
      Effect.provideService(GitActionReceiptStore, gatedStore),
    ),
  );
  const requestId = 'fc8cd2dc-3710-452d-88cb-9ef5e3b2d897';
  const first = {
    requestId,
    projectId: 'project',
    worktreeId: 'first',
    intent: {
      action: 'fetch' as const,
      remoteName: 'origin',
      sourceRef: 'refs/heads/main',
    },
    expected: { upstream: { oid: undefined } },
  };
  const second = { ...first, projectId: 'other-project', worktreeId: 'second' };
  const results = await Effect.runPromise(
    Effect.all(
      [
        accept.execute(first).pipe(Effect.result),
        accept.execute(second).pipe(Effect.result),
      ],
      { concurrency: 2 },
    ),
  );
  expect(
    results
      .map((result) =>
        result._tag === 'Failure' ? result.failure._tag : result.success.kind,
      )
      .sort(),
  ).toEqual(['GitActionReceiptMismatchError', 'accepted']);
  const winner = results[0]._tag === 'Success' ? first : second;
  expect(await Effect.runPromise(store.running())).toMatchObject([
    { requestId, projectId: winner.projectId, worktreeId: winner.worktreeId },
  ]);
  expect(await Effect.runPromise(store.claimExecution({ requestId }))).toBe(
    true,
  );
  expect(await Effect.runPromise(accept.execute(winner))).toMatchObject({
    kind: 'repeated',
  });
  expect(await Effect.runPromise(store.claimExecution({ requestId }))).toBe(
    false,
  );
});

describe('SqliteGitActionReceiptStore collection', () => {
  let opened: {
    session: ManagedRuntime.ManagedRuntime<
      Layer.Success<ReturnType<typeof storageLayer>>,
      never
    >;
    close: () => Promise<void>;
  };

  beforeEach(async () => {
    opened = await openScoped('project', ['collected', 'kept']);
  });

  afterEach(async () => {
    await opened.close();
  });

  it('removes the receipts of a worktree when the worktree is collected, and keeps the others', async () => {
    const store = await opened.session.runPromise(GitActionReceiptStore);
    await Effect.runPromise(store.accept(receipt('collected', 'collected')));
    await Effect.runPromise(store.accept(receipt('kept', 'kept')));
    await Effect.runPromise(
      (await opened.session.runPromise(WorktreePresenceStore)).remove({
        worktreeIds: ['collected'],
      }),
    );
    expect(
      await Effect.runPromise(store.read({ requestId: 'collected' })),
    ).toBeUndefined();
    expect(
      await Effect.runPromise(
        store.latestInterrupted({ worktreeId: 'collected' }),
      ),
    ).toBeUndefined();
    expect(await Effect.runPromise(store.read({ requestId: 'kept' }))).toEqual(
      receipt('kept', 'kept'),
    );
  });
});

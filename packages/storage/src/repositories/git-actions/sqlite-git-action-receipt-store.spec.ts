import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import { gitActionReceiptStoreContract } from '@porcelain/git-actions/store-contracts';

async function openScoped(projectId: string, worktreeIds: readonly string[]) {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
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

describe('SqliteGitActionReceiptStore collection', () => {
  let opened: {
    session: ManagedRuntime.ManagedRuntime<
      Layer.Success<ReturnType<typeof storageLayer>>,
      never
    >;
    close: () => void;
  };

  beforeEach(async () => {
    opened = await openScoped('project', ['collected', 'kept']);
  });

  afterEach(() => {
    opened.close();
  });

  it('removes the receipts of a worktree when the worktree is collected, and keeps the others', async () => {
    const store = await opened.session.runPromise(GitActionReceiptStore);
    await Effect.runPromise(store.insert(receipt('collected', 'collected')));
    await Effect.runPromise(store.insert(receipt('kept', 'kept')));
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

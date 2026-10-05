import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  WorktreePresenceStore,
  InventoryStore,
} from '@porcelain/projects/ports';
import { CommentStore } from '@porcelain/reviews/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import type { CommentThread } from '@porcelain/reviews/models';
import { commentStoreContract } from '@porcelain/reviews/store-contracts';

const project: RegisteredProject = {
  id: 'project',
  name: 'project',
  namedByOwner: false,
  commonDirectory: '/repositories/project/.git',
  repositoryIdentity: 'identity-project',
  available: true,
  position: 1,
};

async function present(
  session: ManagedRuntime.ManagedRuntime<
    Layer.Success<ReturnType<typeof storageLayer>>,
    never
  >,
  worktreeIds: readonly string[],
) {
  await Effect.runPromise(
    (await session.runPromise(WorktreePresenceStore)).save({
      rows: worktreeIds.map((worktreeId) => ({
        worktreeId,
        projectId: project.id,
        missingSince: undefined,
      })),
    }),
  );
}

commentStoreContract('SqliteCommentStore', async (worktreeIds) => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  await Effect.runPromise(
    (await session.runPromise(InventoryStore)).save(project),
  );
  await present(session, worktreeIds);
  return {
    store: await session.runPromise(CommentStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

describe('SqliteCommentStore revisions across collection', () => {
  const kept = 'a'.repeat(64);
  const collected = 'b'.repeat(64);
  let dataDirectory: string;
  let session: ManagedRuntime.ManagedRuntime<
    Layer.Success<ReturnType<typeof storageLayer>>,
    never
  >;

  beforeEach(async () => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    session = ManagedRuntime.make(
      storageLayer(dataDirectory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
    await Effect.runPromise(
      (await session.runPromise(InventoryStore)).save(project),
    );
    await present(session, [kept, collected]);
  });

  afterEach(async () => {
    await session.dispose();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  async function open(id: string, worktreeId: string): Promise<CommentThread> {
    return await Effect.runPromise(
      (await session.runPromise(CommentStore)).insert({
        content: {
          id,
          worktreeId,
          anchor: { kind: 'file', filePath: 'README.md' },
          messages: [{ id: `${id}-opening`, body: 'Why?', author: 'reviewer' }],
        },
        sizeBytes: 4,
        writtenByAgent: false,
      }),
    );
  }

  async function collect(worktreeId: string) {
    await Effect.runPromise(
      (await session.runPromise(WorktreePresenceStore)).remove({
        worktreeIds: [worktreeId],
      }),
    );
  }

  it('hands out a revision above every earlier one after the worktree holding the latest revision is collected', async () => {
    await open('kept-thread', kept);
    const latest = await Effect.runPromise(
      (await session.runPromise(CommentStore)).resolve({
        thread: await open('collected-thread', collected),
        resolved: true,
      }),
    );
    await collect(collected);
    expect((await open('after-collection', kept)).revision).toBeGreaterThan(
      latest.revision,
    );
  });

  it('writes a returning worktree above every revision it had, so a seen mark taken before the collection cannot cover it', async () => {
    await open('other-thread', kept);
    await open('first', collected);
    await open('second', collected);
    const seenBefore = await Effect.runPromise(
      (await session.runPromise(CommentStore)).lastRevision({
        worktreeId: collected,
      }),
    );
    await collect(collected);
    await present(session, [collected]);
    expect((await open('after-return', collected)).revision).toBeGreaterThan(
      seenBefore,
    );
  });
});

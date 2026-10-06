import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import {
  InventoryStore,
  WorktreePresenceStore,
  FilePreferenceStore,
} from '@porcelain/projects/ports';
import {
  ReviewStore,
  ReviewedFileStore,
  ReviewedLayerStore,
  CommentStore,
  CommentSeenStore,
} from '@porcelain/reviews/ports';
import { GitActionReceiptStore } from '@porcelain/git-actions/ports';
import { storageLayer } from '../../index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitActionReceipt } from '@porcelain/git-actions/models';
import type { RegisteredProject } from '@porcelain/projects/models';
import { inventoryStoreContract } from '@porcelain/projects/store-contracts';

const at = '2026-09-01T00:00:00.000Z';

inventoryStoreContract('SqliteInventoryStore', async () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
  const session = ManagedRuntime.make(
    storageLayer(dataDirectory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 5000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  return {
    store: await session.runPromise(InventoryStore),
    close: async () => {
      await session.dispose();
      rmSync(dataDirectory, { recursive: true, force: true });
    },
  };
});

function project(id: string): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/repositories/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position: 1,
  };
}

function receipt(projectId: string, worktreeId: string): GitActionReceipt {
  return {
    requestId: `request-${worktreeId}`,
    projectId,
    worktreeId,
    action: 'fetch',
    intent: { action: 'fetch', remoteName: 'origin', sourceRef: 'main' },
    expected: {},
    state: 'succeeded',
    progress: [],
    refreshRequired: false,
    acceptedAt: '2026-09-23T09:00:00.000Z',
    finishedAt: '2026-09-23T09:00:05.000Z',
  };
}

async function seed(
  session: ManagedRuntime.ManagedRuntime<
    Layer.Success<ReturnType<typeof storageLayer>>,
    never
  >,
  projectId: string,
  worktreeId: string,
) {
  await Effect.runPromise(
    (await session.runPromise(InventoryStore)).save(project(projectId)),
  );
  await Effect.runPromise(
    (await session.runPromise(WorktreePresenceStore)).save({
      rows: [{ worktreeId, projectId, missingSince: undefined }],
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(FilePreferenceStore)).save({
      projectId,
      preference: { path: 'README.md', pinned: true, hidden: false },
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(ReviewStore)).save({
      worktreeId,
      revision: 1,
      publishedAt: at,
      active: true,
      summaryHtml: '<p>Summary</p>',
      summaryToken: `token-${worktreeId}`,
      summarySecret: 'secret',
      layers: [],
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(ReviewedFileStore)).save({
      worktreeId,
      marks: [
        {
          path: 'README.md',
          fingerprint: 'fingerprint',
          reviewedAt: at,
          stale: false,
        },
      ],
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(ReviewedLayerStore)).save({
      worktreeId,
      marks: [
        {
          layerId: 'layer',
          fingerprint: 'fingerprint',
          reviewedAt: at,
        },
      ],
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(CommentStore)).insert({
      content: {
        id: `thread-${worktreeId}`,
        worktreeId,
        anchor: { kind: 'file', filePath: 'README.md' },
        messages: [
          { id: `message-${worktreeId}`, body: 'Why?', author: 'reviewer' },
        ],
      },
      sizeBytes: 4,
      writtenByAgent: false,
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(CommentSeenStore)).save({
      worktreeId,
      seenThrough: 1,
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(GitActionReceiptStore)).insert(
      receipt(projectId, worktreeId),
    ),
  );
}

async function stored(
  session: ManagedRuntime.ManagedRuntime<
    Layer.Success<ReturnType<typeof storageLayer>>,
    never
  >,
  projectId: string,
  worktreeId: string,
) {
  return {
    project:
      (await Effect.runPromise(
        (await session.runPromise(InventoryStore)).find({ projectId }),
      )) !== undefined,
    presence: (
      await Effect.runPromise(
        (await session.runPromise(WorktreePresenceStore)).read({ projectId }),
      )
    ).length,
    preferences: await Effect.runPromise(
      (await session.runPromise(FilePreferenceStore)).count({ projectId }),
    ),
    review:
      (await Effect.runPromise(
        (await session.runPromise(ReviewStore)).read({ worktreeId }),
      )) !== undefined,
    reviewedFiles: (
      await Effect.runPromise(
        (await session.runPromise(ReviewedFileStore)).list({ worktreeId }),
      )
    ).length,
    reviewedLayers: (
      await Effect.runPromise(
        (await session.runPromise(ReviewedLayerStore)).list({ worktreeId }),
      )
    ).length,
    threads: (
      await Effect.runPromise(
        (await session.runPromise(CommentStore)).list({ worktreeId }),
      )
    ).length,
    message:
      (await Effect.runPromise(
        (await session.runPromise(CommentStore)).findMessage({
          messageId: `message-${worktreeId}`,
        }),
      )) !== undefined,
    seenThrough: await Effect.runPromise(
      (await session.runPromise(CommentSeenStore)).seenThrough({ worktreeId }),
    ),
    receipt:
      (await Effect.runPromise(
        (await session.runPromise(GitActionReceiptStore)).read({
          requestId: `request-${worktreeId}`,
        }),
      )) !== undefined,
  };
}

describe('SqliteInventoryStore removal', () => {
  let dataDirectory: string;
  let session: ManagedRuntime.ManagedRuntime<
    Layer.Success<ReturnType<typeof storageLayer>>,
    never
  >;

  beforeEach(() => {
    dataDirectory = mkdtempSync(join(tmpdir(), 'porcelain-storage-'));
    session = ManagedRuntime.make(
      storageLayer(dataDirectory, {
        worktreeIdLength: 32,
        busyTimeoutMs: 5000,
      }).pipe(Layer.provide(NodeServices.layer)),
    );
  });

  afterEach(async () => {
    await session.dispose();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('removes everything stored for the project and its worktrees and keeps every other project', async () => {
    await seed(session, 'removed', 'removed-worktree');
    await seed(session, 'kept', 'kept-worktree');

    await Effect.runPromise(
      (await session.runPromise(InventoryStore)).remove({
        projectId: 'removed',
      }),
    );

    expect(await stored(session, 'removed', 'removed-worktree')).toEqual({
      project: false,
      presence: 0,
      preferences: 0,
      review: false,
      reviewedFiles: 0,
      reviewedLayers: 0,
      threads: 0,
      message: false,
      seenThrough: 0,
      receipt: false,
    });
    expect(await stored(session, 'kept', 'kept-worktree')).toEqual({
      project: true,
      presence: 1,
      preferences: 1,
      review: true,
      reviewedFiles: 1,
      reviewedLayers: 1,
      threads: 1,
      message: true,
      seenThrough: 1,
      receipt: true,
    });
  });
});

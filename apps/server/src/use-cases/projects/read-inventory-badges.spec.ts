import { NodeServices } from '@effect/platform-node';
import { Layer, ManagedRuntime } from 'effect';
import {
  InventoryStore,
  WorktreePresenceStore,
} from '@porcelain/projects/ports';
import { storageLayer } from '@porcelain/storage';
import { WorktreeConsistencyProbe } from '../../ports/worktree-consistency-probe.ts';
import { CheckWorktreeUseCasePort } from '../../ports/check-worktree-use-case-port.ts';
import { LaneOptions } from '../../ports/lane-options.ts';
import {
  ReviewStore,
  ReviewedLayerStore,
  CommentStore,
  CommentSeenStore,
} from '@porcelain/reviews/ports';
import { FileReader, ReadTextFilesOptions } from '@porcelain/files/ports';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { nativeRead } from '@porcelain/effects/worktree';
import { ReadTextFilesService } from '@porcelain/files/services';
import { type ListedWorktree } from '@porcelain/projects/models';
import {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import { type ReviewLayer } from '@porcelain/reviews/models';

import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { ReadInventoryBadgesUseCase } from './read-inventory-badges.ts';

it('lets an arriving writer finish before badge text reads, without holding a read that blocks its own admission', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pc-inventory-badges-'));
  const session = ManagedRuntime.make(
    storageLayer(directory, {
      worktreeIdLength: 32,
      busyTimeoutMs: 1000,
    }).pipe(Layer.provide(NodeServices.layer)),
  );
  const worktree: ListedWorktree = {
    id: 'a'.repeat(32),
    projectId: 'project',
    repositoryId: 'repository',
    path: '/repo',
    branch: 'refs/heads/main',
    main: true,
    available: true,
    metadataIdentity: 'metadata',
    administrativeDirectory: '/repo/.git',
    commonDirectory: '/repo/.git',
    repositoryIdentity: 'identity',
  };
  const layer: ReviewLayer = {
    id: 'layer',
    title: 'Layer',
    summary: 'Text review',
    lanes: ['Files'],
    fingerprint: 'published',
    steps: [
      {
        id: 'step',
        lane: 0,
        title: 'Read',
        text: 'Read the text',
        kind: 'changed',
        pointer: { path: 'README.md', startLine: 1, endLine: 1 },
        published: ['current'],
      },
    ],
  };
  const reviews = await session.runPromise(ReviewStore);
  const marks = await session.runPromise(ReviewedLayerStore);
  await Effect.runPromise(
    (await session.runPromise(InventoryStore)).save({
      id: 'project',
      name: 'project',
      namedByOwner: false,
      commonDirectory: '/repo/.git',
      repositoryIdentity: 'identity',
      available: true,
      position: 1,
    }),
  );
  await Effect.runPromise(
    (await session.runPromise(WorktreePresenceStore)).save({
      rows: [
        {
          worktreeId: worktree.id,
          projectId: 'project',
          missingSince: undefined,
        },
      ],
    }),
  );
  await Effect.runPromise(
    reviews.save({
      worktreeId: worktree.id,
      revision: 1,
      publishedAt: '2026-01-01T00:00:00.000Z',
      active: true,
      summaryHtml: '<p>Review</p>',
      summaryToken: 'token',
      summarySecret: 'secret',
      layers: [layer],
    }),
  );
  await Effect.runPromise(
    marks.save({
      worktreeId: worktree.id,
      marks: [
        {
          layerId: 'layer',
          fingerprint: currentLayerFingerprint(
            layer,
            new Map([['README.md', 'current\n']]),
          ),
          reviewedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
  );
  const consistency = { execute: () => Effect.void };
  const laneRuntime = ManagedRuntime.make(
    Lanes.layer.pipe(
      Layer.provide(
        Layer.succeed(LaneOptions, {
          readCapacity: 2,
          deadlineMs: 1000,
          consistency,
        }),
      ),
    ),
  );
  const lanes = await laneRuntime.runPromise(Lanes);
  const keys = Effect.runSync(LaneKeys.pipe(Effect.provide(LaneKeys.layer)));
  const order: string[] = [];
  let writer: Promise<void> | undefined;
  const access = Effect.runSync(
    WorktreeAccess.pipe(
      Effect.provide(WorktreeAccess.layer),
      Effect.provideService(CheckWorktreeUseCasePort, {
        execute: () =>
          Effect.sync(() => {
            writer = Effect.runPromise(
              lanes.run(keys.repository(worktree), 'write', () =>
                Effect.sync(() => {
                  order.push('write');
                }),
              ),
            );
            return worktree;
          }),
      }),
      Effect.provideService(WorktreeConsistencyProbe, consistency),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(LaneKeys, keys),
    ),
  );
  const read = Effect.runSync(
    ReadTextFilesService.pipe(
      Effect.provide(ReadTextFilesService.layer),
      Effect.provideService(FileReader, {
        read: () => Effect.die(new Error('Badge reads request text only')),
        readText: ({ worktreeId, path }) =>
          nativeRead(worktreeId, () => {
            order.push(`read:${path}`);
            return Promise.resolve({
              kind: 'text' as const,
              text: 'current\n',
              byteLength: 8,
              revision: 'version',
            });
          }),
      }),
      Effect.provideService(ReadTextFilesOptions, { maxBytes: 1000 }),
    ),
  );
  const badges = Effect.runSync(
    ReadInventoryBadgesUseCase.pipe(
      Effect.provide(ReadInventoryBadgesUseCase.layer),
      Effect.provideService(WorktreeAccess, access),
      Effect.provideService(
        ListReviewedLayerPathsService,
        Effect.runSync(
          ListReviewedLayerPathsService.pipe(
            Effect.provide(ListReviewedLayerPathsService.layer),
            Effect.provideService(ReviewStore, reviews),
            Effect.provideService(ReviewedLayerStore, marks),
          ),
        ),
      ),
      Effect.provideService(ReadTextFilesService, read),
      Effect.provideService(
        ReadReviewBadgesService,
        Effect.runSync(
          ReadReviewBadgesService.pipe(
            Effect.provide(ReadReviewBadgesService.layer),
            Effect.provideService(ReviewStore, reviews),
            Effect.provideService(ReviewedLayerStore, marks),
            Effect.provideService(
              CommentStore,
              await session.runPromise(CommentStore),
            ),
            Effect.provideService(
              CommentSeenStore,
              await session.runPromise(CommentSeenStore),
            ),
          ),
        ),
      ),
      Effect.provideService(Lanes, lanes),
      Effect.provideService(LaneKeys, keys),
    ),
  );
  try {
    const result = await Effect.runPromise(
      badges.execute({
        listings: [
          { projectId: 'project', available: true, worktrees: [worktree] },
        ],
      }),
    );
    await writer;
    expect([...result]).toEqual([[worktree.id, 'reviewed']]);
    expect(order).toEqual(['write', 'read:README.md']);
  } finally {
    await laneRuntime.dispose();
    await session.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});

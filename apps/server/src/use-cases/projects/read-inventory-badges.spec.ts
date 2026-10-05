import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { nativeRead } from '@porcelain/effects/worktree';
import { ReadTextFilesService } from '@porcelain/files/services';
import type { ListedWorktree } from '@porcelain/projects/models';
import {
  ListReviewedLayerPathsService,
  ReadReviewBadgesService,
} from '@porcelain/reviews/services';
import { currentLayerFingerprint } from '@porcelain/reviews/rules';
import type { ReviewLayer } from '@porcelain/reviews/models';
import { openStorageSession } from '@porcelain/storage';
import {
  createInventoryStore,
  createWorktreePresenceStore,
} from '@porcelain/storage/projects';
import {
  createReviewStore,
  createReviewedLayerStore,
  createCommentStore,
  createCommentSeenStore,
} from '@porcelain/storage/reviews';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';
import { WorktreeAccess } from '../../runtime/worktree-access.ts';
import { ReadInventoryBadgesUseCase } from './read-inventory-badges.ts';

it('lets an arriving writer finish before badge text reads, without holding a read that blocks its own admission', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pc-inventory-badges-'));
  const session = openStorageSession(directory, {
    worktreeIdLength: 32,
    busyTimeoutMs: 1000,
  });
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
  const reviews = createReviewStore(session);
  const marks = createReviewedLayerStore(session);
  createInventoryStore(session).save({
    id: 'project',
    name: 'project',
    namedByOwner: false,
    commonDirectory: '/repo/.git',
    repositoryIdentity: 'identity',
    available: true,
    position: 1,
  });
  createWorktreePresenceStore(session).save({
    rows: [
      {
        worktreeId: worktree.id,
        projectId: 'project',
        missingSince: undefined,
      },
    ],
  });
  reviews.save({
    worktreeId: worktree.id,
    revision: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    active: true,
    summaryHtml: '<p>Review</p>',
    summaryToken: 'token',
    summarySecret: 'secret',
    layers: [layer],
  });
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
  });
  const consistency = { execute: () => Effect.void };
  const lanes = new Lanes({ readCapacity: 2, deadlineMs: 1000, consistency });
  const keys = new LaneKeys();
  const order: string[] = [];
  let writer: Promise<void> | undefined;
  const access = new WorktreeAccess(
    {
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
    },
    consistency,
    lanes,
    keys,
  );
  const read = new ReadTextFilesService(
    {
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
    },
    { maxBytes: 1000 },
  );
  const badges = new ReadInventoryBadgesUseCase(
    access,
    new ListReviewedLayerPathsService(reviews, marks),
    read,
    new ReadReviewBadgesService(
      reviews,
      marks,
      createCommentStore(session),
      createCommentSeenStore(session),
    ),
    lanes,
    keys,
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
    await lanes.close();
    session.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

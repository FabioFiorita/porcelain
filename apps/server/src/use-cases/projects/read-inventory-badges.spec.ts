import { NodeServices } from '@effect/platform-node';
import { Context, Deferred, Layer, Scope } from 'effect';
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
import { expect, it } from '@effect/vitest';
import { admittedRead } from '@porcelain/effects/worktree';
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

it.effect(
  'lets an arriving writer finish before badge text reads, without holding a read that blocks its own admission',
  () =>
    Effect.gen(function* () {
      const directory = mkdtempSync(join(tmpdir(), 'pc-inventory-badges-'));
      const session = yield* Layer.build(
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
      const reviews = Context.get(session, ReviewStore);
      const marks = Context.get(session, ReviewedLayerStore);
      yield* Context.get(session, InventoryStore).save({
        id: 'project',
        name: 'project',
        namedByOwner: false,
        commonDirectory: '/repo/.git',
        repositoryIdentity: 'identity',
        available: true,
        position: 1,
      });
      yield* Context.get(session, WorktreePresenceStore).save({
        rows: [
          {
            worktreeId: worktree.id,
            projectId: 'project',
            missingSince: undefined,
          },
        ],
      });
      yield* reviews.save({
        worktreeId: worktree.id,
        revision: 1,
        publishedAt: '2026-01-01T00:00:00.000Z',
        active: true,
        summaryHtml: '<p>Review</p>',
        summaryToken: 'token',
        summarySecret: 'secret',
        layers: [layer],
      });
      yield* marks.save({
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
      const laneContext = yield* Layer.build(
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
      const lanes = Context.get(laneContext, Lanes);
      const keys = yield* LaneKeys.pipe(Effect.provide(LaneKeys.layer));
      const order: string[] = [];
      const writerDone = yield* Deferred.make<void>();
      const scope = yield* Scope.Scope;
      const access = yield* WorktreeAccess.pipe(
        Effect.provide(WorktreeAccess.layer),
        Effect.provideService(CheckWorktreeUseCasePort, {
          execute: () =>
            Effect.gen(function* () {
              yield* Effect.forkIn(
                lanes
                  .run(keys.repository(worktree), 'write', () =>
                    Effect.sync(() => {
                      order.push('write');
                    }),
                  )
                  .pipe(
                    Effect.ensuring(Deferred.succeed(writerDone, undefined)),
                  ),
                scope,
                { startImmediately: true },
              );
              return worktree;
            }),
        }),
        Effect.provideService(WorktreeConsistencyProbe, consistency),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(LaneKeys, keys),
      );
      const read = yield* ReadTextFilesService.pipe(
        Effect.provide(ReadTextFilesService.layer),
        Effect.provideService(FileReader, {
          read: () => Effect.die(new Error('Badge reads request text only')),
          readText: ({ worktreeId, path }) =>
            admittedRead(
              worktreeId,
              Effect.sync(() => {
                order.push(`read:${path}`);
                return {
                  kind: 'text' as const,
                  text: 'current\n',
                  byteLength: 8,
                  revision: 'version',
                };
              }),
            ),
        }),
        Effect.provideService(ReadTextFilesOptions, { maxBytes: 1000 }),
      );
      const badges = yield* ReadInventoryBadgesUseCase.pipe(
        Effect.provide(ReadInventoryBadgesUseCase.layer),
        Effect.provideService(WorktreeAccess, access),
        Effect.provideService(
          ListReviewedLayerPathsService,
          yield* ListReviewedLayerPathsService.pipe(
            Effect.provide(ListReviewedLayerPathsService.layer),
            Effect.provideService(ReviewStore, reviews),
            Effect.provideService(ReviewedLayerStore, marks),
          ),
        ),
        Effect.provideService(ReadTextFilesService, read),
        Effect.provideService(
          ReadReviewBadgesService,
          yield* ReadReviewBadgesService.pipe(
            Effect.provide(ReadReviewBadgesService.layer),
            Effect.provideService(ReviewStore, reviews),
            Effect.provideService(ReviewedLayerStore, marks),
            Effect.provideService(
              CommentStore,
              Context.get(session, CommentStore),
            ),
            Effect.provideService(
              CommentSeenStore,
              Context.get(session, CommentSeenStore),
            ),
          ),
        ),
        Effect.provideService(Lanes, lanes),
        Effect.provideService(LaneKeys, keys),
      );
      try {
        const result = yield* badges.execute({
          listings: [
            { projectId: 'project', available: true, worktrees: [worktree] },
          ],
        });
        yield* Deferred.await(writerDone);
        expect([...result]).toEqual([[worktree.id, 'reviewed']]);
        expect(order).toEqual(['write', 'read:README.md']);
      } finally {
        yield* lanes.close();
        rmSync(directory, { recursive: true, force: true });
      }
    }),
);

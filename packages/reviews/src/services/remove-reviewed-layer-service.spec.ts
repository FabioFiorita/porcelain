import { reviewFixture } from '../../spec/fixtures/review.ts';
import {
  BranchReviewReader,
  ReviewedLayerStore,
} from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { RemoveReviewedLayerService } from './remove-reviewed-layer-service.ts';

const worktreeId = 'a'.repeat(64);
const other = 'b'.repeat(64);
const reviewedAt = '2026-09-01T00:00:00.000Z';

function mark(layerId: string) {
  return {
    layerId,
    fingerprint: `fingerprint-${layerId}`,
    reviewedAt,
  };
}

function setup() {
  const store = new InMemoryReviewedLayerStore([
    { reviewId: worktreeId, ...mark('layer-1') },
    { reviewId: worktreeId, ...mark('layer-2') },
    { reviewId: other, ...mark('layer-1') },
  ]);
  return {
    store,
    service: Effect.runSync(
      RemoveReviewedLayerService.pipe(
        Effect.provide(RemoveReviewedLayerService.layer),
        Effect.provideService(ReviewedLayerStore, store),
        Effect.provideService(BranchReviewReader, {
          read: (input) =>
            Effect.succeed(
              reviewFixture({
                worktreeId: input.worktreeId,
                reviewId: input.worktreeId,
                layers: ['layer-1', 'layer-2'].map((id) => ({
                  id,
                  fingerprint: `fingerprint-${id}`,
                  title: id,
                  summary: 'Stored decision',
                  lanes: [],
                  steps: [],
                })),
              }),
            ),
          byWorktrees: () => Effect.succeed([]),
        }),
      ),
    ),
  };
}

describe('RemoveReviewedLayerService', () => {
  it('removes the mark, keeps the others and reports the removal', async () => {
    const { store, service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, layerId: 'layer-1' })),
    ).toEqual({
      removed: true,
    });
    expect(
      await Effect.runPromise(store.list({ reviewId: worktreeId })),
    ).toEqual([mark('layer-2')]);
  });

  it('leaves the same layer marked in another worktree', async () => {
    const { store, service } = setup();
    Effect.runSync(service.execute({ worktreeId, layerId: 'layer-1' }));
    expect(await Effect.runPromise(store.list({ reviewId: other }))).toEqual([
      mark('layer-1'),
    ]);
  });

  it('reports nothing removed for a layer that was never marked', async () => {
    const { store, service } = setup();
    expect(
      Effect.runSync(service.execute({ worktreeId, layerId: 'layer-3' }))
        .removed,
    ).toBe(false);
    expect(
      await Effect.runPromise(store.list({ reviewId: worktreeId })),
    ).toHaveLength(2);
  });

  it('reports nothing removed when the same mark is removed twice', () => {
    const { service } = setup();
    Effect.runSync(service.execute({ worktreeId, layerId: 'layer-1' }));
    expect(
      Effect.runSync(service.execute({ worktreeId, layerId: 'layer-1' }))
        .removed,
    ).toBe(false);
  });
});

import {
  BranchReviewReader,
  ReviewedLayerStore,
} from '@porcelain/reviews/ports';
import { Effect } from 'effect';
import { expect, it } from 'vitest';
import { reviewFixture } from '../../spec/fixtures/review.ts';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { ListReviewedLayersService } from './list-reviewed-layers-service.ts';

it('resolves the current branch review and reads only its own decision marks', () => {
  const layer = {
    id: 'decision',
    title: 'Owner',
    summary: 'One owner',
    lanes: ['Owner'],
    steps: [],
    fingerprint: 'published',
  };
  const review = reviewFixture({ layers: [layer] });
  const reviews = new InMemoryReviewStore([review]);
  const mark = {
    layerId: layer.id,
    fingerprint: 'published',
    reviewedAt: review.publishedAt,
  };
  const marks = new InMemoryReviewedLayerStore([
    { reviewId: review.reviewId, ...mark },
    { reviewId: 'another-review', ...mark, fingerprint: 'other' },
  ]);
  const service = Effect.runSync(
    ListReviewedLayersService.pipe(
      Effect.provide(ListReviewedLayersService.layer),
      Effect.provideService(BranchReviewReader, reviews.branchReader),
      Effect.provideService(ReviewedLayerStore, marks),
    ),
  );
  expect(
    Effect.runSync(service.execute({ worktreeId: review.worktreeId })),
  ).toEqual({
    worktreeId: review.worktreeId,
    marks: [{ ...mark, stale: false }],
  });
  expect(
    Effect.runSync(service.execute({ worktreeId: 'another-worktree' })),
  ).toEqual({ worktreeId: 'another-worktree', marks: [] });
});

import { testClock } from '@porcelain/kernel/test-kit';
import { ReviewedLayerStore } from '@porcelain/reviews/ports';
import { Clock, Effect } from 'effect';
import { expect, it } from 'vitest';
import { ReviewedMarkConflictError } from '@porcelain/reviews/errors';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';
import { SetReviewedLayerService } from './set-reviewed-layer-service.ts';

it('marks the immutable decision fingerprint and refuses a fingerprint from another revision', async () => {
  const store = new InMemoryReviewedLayerStore();
  const service = Effect.runSync(
    SetReviewedLayerService.pipe(
      Effect.provide(SetReviewedLayerService.layer),
      Effect.provideService(ReviewedLayerStore, store),
      Effect.provideService(
        Clock.Clock,
        await testClock('2026-10-19T00:00:00.000Z'),
      ),
    ),
  );
  const layer = {
    id: 'decision',
    title: 'Owner',
    summary: 'One owner',
    lanes: ['Owner'],
    steps: [],
    fingerprint: 'published',
  };
  const mark = Effect.runSync(
    service.execute({ reviewId: 'review', layer, fingerprint: 'published' }),
  );
  expect(mark).toEqual({
    layerId: 'decision',
    fingerprint: 'published',
    reviewedAt: '2026-10-19T00:00:00.000Z',
  });
  expect(Effect.runSync(store.list({ reviewId: 'review' }))).toEqual([mark]);
  expect(() =>
    Effect.runSync(
      service.execute({
        reviewId: 'review',
        layer,
        fingerprint: 'another-revision',
      }),
    ),
  ).toThrow(ReviewedMarkConflictError);
});

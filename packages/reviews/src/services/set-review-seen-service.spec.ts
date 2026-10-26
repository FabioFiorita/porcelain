import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { reviewFixture, reviewSave } from '../../spec/fixtures/review.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { SetReviewSeenService } from './set-review-seen-service.ts';

it.each([
  { seen: 0, revision: 1, updated: true, expected: 1 },
  { seen: 1, revision: 2, updated: true, expected: 2 },
  { seen: 2, revision: 2, updated: false, expected: 2 },
  { seen: 2, revision: 1, updated: false, expected: 2 },
])(
  'records revision $revision after seeing $seen only when it advances the reader',
  async ({ seen, revision, updated, expected }) => {
    const store = new InMemoryReviewStore();
    for (const revision of [1, 2])
      await Effect.runPromise(
        store.save(reviewSave(reviewFixture({ revision }))),
      );
    const { reviewId } = reviewFixture();
    await Effect.runPromise(store.markSeen({ reviewId, revision: seen }));
    const result = await Effect.runPromise(
      Effect.flatMap(SetReviewSeenService, (service) =>
        service.execute({ reviewId, revision }),
      ).pipe(
        Effect.provide(
          SetReviewSeenService.layer.pipe(
            Layer.provide(Layer.succeed(ReviewStore, store)),
          ),
        ),
      ),
    );
    expect(result).toEqual({ updated });
    expect(
      (await Effect.runPromise(store.readRecord({ reviewId })))
        ?.lastSeenRevision,
    ).toBe(expected);
  },
);

it.each([false, true])(
  'refuses a missing revision even when the review exists: %s',
  async (exists) => {
    const store = new InMemoryReviewStore(exists ? [reviewFixture()] : []);
    const { reviewId } = reviewFixture();
    await expect(
      Effect.runPromise(
        Effect.flatMap(SetReviewSeenService, (service) =>
          service.execute({ reviewId, revision: 2 }),
        ).pipe(
          Effect.provide(
            SetReviewSeenService.layer.pipe(
              Layer.provide(Layer.succeed(ReviewStore, store)),
            ),
          ),
        ),
      ),
    ).rejects.toMatchObject({ _tag: 'ReviewNotFoundError' });
    expect(
      (await Effect.runPromise(store.readRecord({ reviewId })))
        ?.lastSeenRevision,
    ).toBe(exists ? 0 : undefined);
  },
);

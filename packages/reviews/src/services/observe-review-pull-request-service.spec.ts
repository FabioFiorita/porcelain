import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { githubPullRequest } from '../../spec/fixtures/github-pull-request.ts';
import { reviewFixture, reviewSave } from '../../spec/fixtures/review.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { SetReviewStateService } from './set-review-state-service.ts';
import { ObserveReviewPullRequestService } from './observe-review-pull-request-service.ts';
it.each([
  ['OPEN', 'open'],
  ['CLOSED', 'closed'],
  ['MERGED', 'closed'],
] as const)(
  'observes %s idempotently through the existing lifecycle transition',
  async (state, expected) => {
    const store = new InMemoryReviewStore();
    const review = reviewFixture();
    await Effect.runPromise(
      store.save(
        reviewSave(review, {
          pullRequest: 'https://github.com/fabiofiorita/porcelain/pull/423',
        }),
      ),
    );
    const layer = ObserveReviewPullRequestService.layer.pipe(
      Layer.provide(SetReviewStateService.layer),
      Layer.provide(Layer.succeed(ReviewStore, store)),
    );
    const observe = Effect.flatMap(ObserveReviewPullRequestService, (service) =>
      service.execute({
        reviewId: review.reviewId,
        pullRequest: githubPullRequest({ state }),
      }),
    ).pipe(Effect.provide(layer));
    expect(await Effect.runPromise(observe)).toMatchObject({
      pullRequest: { state: state.toLowerCase(), matchesReviewHead: true },
      closedReview: state !== 'OPEN',
    });
    expect(await Effect.runPromise(observe)).toMatchObject({
      pullRequest: { matchesReviewHead: true },
      closedReview: false,
    });
    expect(
      await Effect.runPromise(store.readRecord({ reviewId: review.reviewId })),
    ).toMatchObject({ state: expected });
    expect(
      await Effect.runPromise(store.read({ reviewId: review.reviewId })),
    ).toMatchObject({ headOid: 'a'.repeat(40), revision: 1 });
  },
);

it.each([undefined, 'https://github.com/fabiofiorita/porcelain/pull/424'])(
  'does not close the review when a delayed merged observation no longer matches its link %s',
  async (pullRequest) => {
    const store = new InMemoryReviewStore();
    const review = reviewFixture();
    await Effect.runPromise(store.save(reviewSave(review, { pullRequest })));
    const layer = ObserveReviewPullRequestService.layer.pipe(
      Layer.provide(SetReviewStateService.layer),
      Layer.provide(Layer.succeed(ReviewStore, store)),
    );
    const answer = await Effect.runPromise(
      Effect.flatMap(ObserveReviewPullRequestService, (service) =>
        service.execute({
          reviewId: review.reviewId,
          pullRequest: githubPullRequest({ state: 'MERGED' }),
        }),
      ).pipe(Effect.provide(layer)),
    );
    expect(answer.closedReview).toBe(false);
    expect(await Effect.runPromise(store.readRecord(review))).toMatchObject({
      state: 'open',
      pullRequest,
    });
  },
);

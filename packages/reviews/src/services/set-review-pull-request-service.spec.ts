import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { githubPullRequest } from '../../spec/fixtures/github-pull-request.ts';
import { reviewFixture, reviewSave } from '../../spec/fixtures/review.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { SetReviewPullRequestService } from './set-review-pull-request-service.ts';

it.each(['OPEN', 'CLOSED', 'MERGED'] as const)(
  'links a %s PR without changing revisions, marks or lifecycle, then clears idempotently',
  async (state) => {
    const store = new InMemoryReviewStore();
    const review = reviewFixture();
    await Effect.runPromise(store.save(reviewSave(review)));
    const execute = (
      pullRequest: ReturnType<typeof githubPullRequest> | undefined,
    ) =>
      Effect.runPromise(
        Effect.flatMap(SetReviewPullRequestService, (service) =>
          service.execute({ reviewId: review.reviewId, pullRequest }),
        ).pipe(
          Effect.provide(SetReviewPullRequestService.layer),
          Effect.provide(Layer.succeed(ReviewStore, store)),
        ),
      );
    await execute(githubPullRequest({ state, headRefName: 'feature' }));
    expect(await Effect.runPromise(store.readRecord(review))).toMatchObject({
      pullRequest: 'https://github.com/fabiofiorita/porcelain/pull/423',
      state: 'open',
      latestRevision: 1,
    });
    await execute(undefined);
    await execute(undefined);
    expect(await Effect.runPromise(store.readRecord(review))).toMatchObject({
      branch: 'feature',
      pullRequest: undefined,
      latestRevision: 1,
      state: 'open',
    });
    expect(await Effect.runPromise(store.read(review))).toEqual(review);
  },
);

it('refuses a different head branch without altering the link', async () => {
  const store = new InMemoryReviewStore();
  const review = reviewFixture();
  await Effect.runPromise(store.save(reviewSave(review)));
  const result = await Effect.runPromise(
    Effect.flatMap(SetReviewPullRequestService, (service) =>
      service.execute({
        reviewId: review.reviewId,
        pullRequest: githubPullRequest(),
      }),
    ).pipe(
      Effect.provide(SetReviewPullRequestService.layer),
      Effect.provide(Layer.succeed(ReviewStore, store)),
      Effect.result,
    ),
  );
  expect(result).toMatchObject({
    _tag: 'Failure',
    failure: {
      _tag: 'ReviewPullRequestRefusedError',
      message: 'The pull request head must be feature.',
    },
  });
  expect(await Effect.runPromise(store.readRecord(review))).not.toHaveProperty(
    'pullRequest',
  );
});

it.each([true, false])(
  'refuses a conflicting open review when linking is %s',
  async (linking) => {
    const store = new InMemoryReviewStore();
    const review = reviewFixture();
    const url = 'https://github.com/fabiofiorita/porcelain/pull/423';
    await Effect.runPromise(
      store.save(
        reviewSave(review, { pullRequest: linking ? undefined : url }),
      ),
    );
    const other = reviewFixture({
      reviewId: '10000000-0000-4000-8000-000000000002',
    });
    await Effect.runPromise(
      store.save(reviewSave(other, { pullRequest: linking ? url : undefined })),
    );
    const result = await Effect.runPromise(
      Effect.flatMap(SetReviewPullRequestService, (service) =>
        service.execute({
          reviewId: review.reviewId,
          pullRequest: linking
            ? githubPullRequest({ headRefName: 'feature' })
            : undefined,
        }),
      ).pipe(
        Effect.provide(SetReviewPullRequestService.layer),
        Effect.provide(Layer.succeed(ReviewStore, store)),
        Effect.flip,
      ),
    );
    expect(result._tag).toBe('ReviewPullRequestRefusedError');
    expect(await Effect.runPromise(store.readRecord(review))).toMatchObject({
      pullRequest: linking ? undefined : url,
    });
  },
);

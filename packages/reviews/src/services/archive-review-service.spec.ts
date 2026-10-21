import { Effect, Layer } from 'effect';
import { expect, it } from 'vitest';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { reviewFixture, reviewSave } from '../../spec/fixtures/review.ts';
import { ReviewStore } from '../ports/review-store.ts';
import { ReviewArchiver } from '../ports/review-archiver.ts';
import { ArchiveReviewService } from './archive-review-service.ts';
const plan = {
  worktreePath: undefined,
  localBranch: undefined,
  remoteBranch: undefined,
  mainCheckout: true,
  dirty: false,
  unpushed: false,
  fingerprint: 'main',
};
it.each([false, true])(
  'closed PR=%s archives only eligible reviews and retains the saved revision',
  async (pullRequestClosed) => {
    const store = new InMemoryReviewStore();
    const review = reviewFixture();
    await Effect.runPromise(
      store.save(
        reviewSave(review, {
          pullRequest: 'https://github.com/owner/repo/pull/1',
        }),
      ),
    );
    const layer = ArchiveReviewService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(ReviewStore, store),
          Layer.succeed(ReviewArchiver, {
            execute: () => Effect.succeed(plan),
          }),
        ),
      ),
    );
    const archive = Effect.flatMap(ArchiveReviewService, (service) =>
      service.execute({
        reviewId: review.reviewId,
        pullRequestClosed,
        repositoryIdentity: 'repository',
        options: {
          deleteWorktree: true,
          deleteLocalBranch: true,
          deleteRemoteBranch: true,
        },
        confirmation: { plan, discardChanges: false },
      }),
    ).pipe(Effect.provide(layer));
    if (pullRequestClosed)
      expect(await Effect.runPromise(archive)).toEqual({
        archived: true,
        plan,
      });
    else
      await expect(Effect.runPromise(archive)).rejects.toThrow(
        'Only reviews with a merged or closed',
      );
    expect(
      (await Effect.runPromise(store.readRecord({ reviewId: review.reviewId })))
        ?.archived,
    ).toBe(pullRequestClosed);
    expect(
      (await Effect.runPromise(store.read({ reviewId: review.reviewId })))
        ?.headOid,
    ).toBe('a'.repeat(40));
  },
);

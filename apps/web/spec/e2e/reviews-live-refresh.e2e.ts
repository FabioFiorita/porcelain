import { expect, test } from './fixtures.ts';

for (const revision of ['', '/1']) {
  test(`opening a durable review${revision} records it seen once after its live refresh settles`, async ({
    pairedPage,
    app,
    repo,
    seenRequests,
  }) => {
    const review = await repo.review('Keep review reads stable while opening');
    await app.open(`/reviews/${review.reviewId}${revision}`);
    await expect(
      pairedPage.getByRole('region', { name: 'Briefing', exact: true }),
    ).toBeVisible();
    await pairedPage.waitForLoadState('networkidle');
    await expect.poll(() => seenRequests.count(review.reviewId)).toBe(1);
  });
}

test('a failed seen acknowledgement offers one pending retry and recovers', async ({
  pairedPage,
  app,
  repo,
  seenRequests,
}) => {
  const review = await repo.review('Recover the seen acknowledgement');
  const endOutage = await seenRequests.fail(review.reviewId);
  const held = await seenRequests.holdNext(review.reviewId);
  try {
    await app.open(`/reviews/${review.reviewId}`);
    const failure = pairedPage.getByRole('alert').filter({
      hasText: 'This revision could not be recorded as seen.',
    });
    await expect(failure).toBeVisible();
    await pairedPage.waitForLoadState('networkidle');
    await expect.poll(() => seenRequests.count(review.reviewId)).toBe(1);
    await endOutage();
    held.arm();
    const retry = failure.getByRole('button', {
      name: 'Try again',
      exact: true,
    });
    await retry.click();
    await held.requested;
    await expect(retry).toBeDisabled();
    await expect.poll(() => seenRequests.count(review.reviewId)).toBe(2);
    held.release();
    await expect(failure).not.toBeAttached();
    await pairedPage.waitForLoadState('networkidle');
    await expect.poll(() => seenRequests.count(review.reviewId)).toBe(2);
  } finally {
    held.release();
  }
});

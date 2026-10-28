import { expect, test } from './fixtures.ts';

test('a failed live refresh keeps the retained review readable, warns, and retries the latest revision', async ({
  pairedPage: page,
  app,
  repo,
  live,
}) => {
  const review = await repo.review('Original retained review');
  await app.open(`/reviews/${review.reviewId}`);
  const briefing = page.getByRole('region', { name: 'Briefing', exact: true });
  await expect(briefing).toBeVisible();
  await page.waitForLoadState('networkidle');
  const endOutage = await live.failDurableReviewRead(review.reviewId);
  await repo.review('New published revision');
  const failure = page.getByRole('alert').filter({
    hasText:
      'This review could not be refreshed. Showing the last loaded revision.',
  });
  await expect(failure).toBeVisible();
  await expect(briefing).toContainText('Revision 1 of 1');
  await endOutage();
  await failure.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(briefing).toContainText('Revision 2 of 2');
  await expect(failure).not.toBeAttached();
});

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

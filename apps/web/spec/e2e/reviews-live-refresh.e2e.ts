import { expect, test } from './fixtures.ts';

for (const revision of ['', '/1']) {
  test(`opening a durable review${revision} records it seen once after its live refresh settles`, async ({
    pairedPage,
    app,
    repo,
  }) => {
    const review = await repo.review('Keep review reads stable while opening');
    const seenPath = `/api/reviews/${review.reviewId}/seen`;
    const seen: string[] = [];
    pairedPage.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === 'PUT' && path === seenPath) seen.push(path);
    });
    await app.open(`/reviews/${review.reviewId}${revision}`);
    await expect(
      pairedPage.getByRole('region', { name: 'Briefing', exact: true }),
    ).toBeVisible();
    await pairedPage.waitForLoadState('networkidle');
    expect(seen).toEqual([seenPath]);
  });
}

test('a failed seen acknowledgement offers one pending retry and recovers', async ({
  pairedPage,
  app,
  repo,
}) => {
  const review = await repo.review('Recover the seen acknowledgement');
  const seenPath = `/api/reviews/${review.reviewId}/seen`;
  const retryRequested = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  let unavailable = true;
  let writes = 0;
  await pairedPage.route(`**${seenPath}`, async (route) => {
    writes += 1;
    if (unavailable)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Seen acknowledgement unavailable' }),
      });
    else {
      retryRequested.resolve();
      await released.promise;
      await route.continue();
    }
  });
  try {
    await app.open(`/reviews/${review.reviewId}`);
    const failure = pairedPage.getByRole('alert').filter({
      hasText: 'This revision could not be recorded as seen.',
    });
    await expect(failure).toBeVisible();
    await pairedPage.waitForLoadState('networkidle');
    expect(writes).toBe(1);
    unavailable = false;
    const retry = failure.getByRole('button', {
      name: 'Try again',
      exact: true,
    });
    await retry.click();
    await retryRequested.promise;
    await expect(retry).toBeDisabled();
    expect(writes).toBe(2);
    released.resolve();
    await expect(failure).not.toBeAttached();
    await pairedPage.waitForLoadState('networkidle');
    expect(writes).toBe(2);
  } finally {
    released.resolve();
  }
});

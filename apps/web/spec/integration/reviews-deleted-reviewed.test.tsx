import { expect, test } from './fixtures.tsx';

test('a retained removal can be reviewed and unmarked, and counts toward every file reviewed', async ({
  repo,
  render,
  server,
}) => {
  await repo.review('Replace the retired owner');
  const fixture = await repo.review('Replace the retired owner');
  await repo.removeReviewWorktree();
  const app = await render.route(
    `/reviews/${fixture.reviewId}/2/decisions/${fixture.layerId}`,
  );
  const review = app.page.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .element(
      review.getByRole('button', { name: 'Decision reviewed', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await app.navigate(`/reviews/${fixture.reviewId}/2`);
  await review
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  const completion = review.getByRole('region', {
    name: 'Review completion',
    exact: true,
  });
  const dock = review.getByRole('navigation', {
    name: 'Walkthrough dock',
    exact: true,
  });
  await expect
    .element(
      dock.getByRole('button', { name: 'Mark 1 file reviewed', exact: true }),
    )
    .toBeEnabled();
  await expect
    .element(completion.getByText('1 of 2 files reviewed', { exact: true }))
    .toBeVisible();
  const removed = review.getByRole('button', {
    name: 'Mark retired.ts as reviewed',
    exact: true,
  });
  await removed.click();
  const unmark = review.getByRole('button', {
    name: 'Unmark retired.ts as unreviewed',
    exact: true,
  });
  await expect.element(unmark).toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(
      dock.getByRole('button', { name: 'Every file reviewed', exact: true }),
    )
    .toBeDisabled();
  await expect
    .element(completion.getByText('2 of 2 files reviewed', { exact: true }))
    .toBeVisible();
  await expect
    .poll(() => server.reviewMarks(fixture.reviewId))
    .toMatchObject({
      files: [{ path: 'retired.ts' }, { path: 'review-page.ts' }],
      decisions: [{ layerId: fixture.layerId }],
    });
  await unmark.click();
  await expect.element(removed).toHaveAttribute('aria-pressed', 'false');
  await expect
    .element(completion.getByText('1 of 2 files reviewed', { exact: true }))
    .toBeVisible();
  await dock
    .getByRole('button', { name: 'Mark 1 file reviewed', exact: true })
    .click();
  await expect.element(unmark).toHaveAttribute('aria-pressed', 'true');
  await app.navigate(`/reviews/${fixture.reviewId}/1`);
  await review
    .getByRole('button', { name: 'Not explained', exact: true })
    .click();
  await expect
    .element(completion.getByText('1 of 2 files reviewed', { exact: true }))
    .toBeVisible();
  await app.navigate(`/reviews/${fixture.reviewId}/2`);
  await expect.element(unmark).toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(completion.getByText('2 of 2 files reviewed', { exact: true }))
    .toBeVisible();
});

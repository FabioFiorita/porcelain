import { expect, test } from './fixtures.tsx';

test('an open latest review follows a new publication while a numbered revision stays pinned', async ({
  repo,
  render,
}) => {
  const first = await repo.review('Read the first immutable decision');
  const app = await render.route(`/reviews/${first.reviewId}`);
  const review = app.page.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(
      review.getByRole('heading', {
        name: `Proven at ${first.headOid.slice(0, 7)}`,
        exact: true,
      }),
    )
    .toBeVisible();
  const second = await repo.review('Read the second immutable decision');
  await expect
    .element(review.getByRole('button', { name: 'r2', exact: true }))
    .toBeVisible();
  await expect
    .element(
      review.getByRole('heading', {
        name: `Proven at ${second.headOid.slice(0, 7)}`,
        exact: true,
      }),
    )
    .toBeVisible();
  await review.getByRole('button', { name: 'r1', exact: true }).click();
  await expect
    .element(
      review.getByRole('heading', {
        name: `Proven at ${first.headOid.slice(0, 7)}`,
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.poll(() => app.location()).toBe(`/reviews/${first.reviewId}/1`);
});

test('sidebar decisions return from an older revision or summary to the latest walkthrough', async ({
  agent,
  render,
}) => {
  await agent.publishReview('First decision');
  await agent.publishReview('Latest decision');
  const workspace = await render.workspace();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review.getByRole('button', { name: 'r1', exact: true }).click();
  await expect
    .element(review.getByRole('button', { name: 'r1', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await workspace
    .getByRole('tab', { name: 'Agent summary', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('dialog', { name: 'Worktree review', exact: true })
    .getByRole('tab', { name: 'Review', exact: true })
    .click();
  const row = workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('button', { name: /^1 Latest decision/ });
  await row.click();
  await expect
    .element(review.getByRole('button', { name: 'latest', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .element(workspace.getByRole('tab', { name: 'Walkthrough', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(
      review.getByRole('region', { name: '1. Latest decision', exact: true }),
    )
    .toBeVisible();
  await review
    .getByRole('button', { name: 'Open the briefing', exact: true })
    .click();
  await expect
    .element(review.getByRole('button', { name: 'latest', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
});

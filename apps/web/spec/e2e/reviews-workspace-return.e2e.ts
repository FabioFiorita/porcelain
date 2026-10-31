import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';
import { reviewReturnProbe } from '../kit/review-return.ts';

test('returning to a visited review reuses warm content and a later publication still refreshes the selected scope', async ({
  pairedPage: page,
  agent,
  server,
  app,
}) => {
  const initial = await server.project();
  const main = initial.worktrees.find((entry) => entry.main);
  if (!main) throw new Error('Missing main checkout');
  await archiveFixture(main.path);
  await agent.publishReview('Main cache decision');
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId) throw new Error('Missing main review');
  await app.reload();
  await page.setViewportSize({ width: 1440, height: 896 });
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await expect(
    page.getByText('Revision 1 of 1', { exact: true }),
  ).toBeVisible();
  await sidebar.getByRole('button', { name: /^archive-fixture,/ }).click();
  await expect(
    sidebar.getByRole('button', { name: /^archive-fixture,.*Current$/ }),
  ).toBeVisible();
  await expect(
    page.getByText('Revision 1 of 1', { exact: true }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  const probe = await reviewReturnProbe(page, published.reviewId);
  try {
    await sidebar.getByRole('button', { name: /Main worktree/ }).click();
    await expect(
      sidebar.getByRole('button', { name: /Main worktree.*Current$/ }),
    ).toBeVisible();
    await expect(
      page.getByText('Revision 1 of 1', { exact: true }),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect
      .poll(() => probe.result())
      .toEqual({ heavyReads: [], loading: false });
  } finally {
    await probe.close();
  }
  await agent.publishReview('Updated main cache decision');
  await expect(
    page.getByText('Revision 2 of 2', { exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole('button', { name: /Main worktree.*Current$/ }),
  ).toHaveCount(1);
  await expect.poll(() => app.address().path).toBe(`/${initial.id}/${main.id}`);
});

import { reviewDiffLayout } from '../kit/review-diff-layout.ts';
import { expect, test } from './fixtures.ts';

test('wrapped decision diffs and inline threads end above the existing-code section', async ({
  pairedPage: page,
  app,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId) throw new Error('Missing published review');
  await page.setViewportSize({ width: 1080, height: 900 });
  await app.open('/settings/general');
  await page.getByRole('tab', { name: 'Unified', exact: true }).click();
  await page.getByRole('tab', { name: 'Wrap', exact: true }).click();
  await app.open(`/reviews/${published.reviewId}`);
  await page
    .getByRole('button', {
      name: 'Go to 1. Invite a teammate',
      exact: true,
    })
    .click();
  const existing = page.getByRole('region', {
    name: 'Existing code it relies on',
    exact: true,
  });
  const code = reviewDiffLayout(page);
  await existing.scrollIntoViewIfNeeded();
  await expect
    .poll(() => code.read())
    .toEqual({ files: 6, notes: 6, wrapped: true, overlaps: [] });
  await code.commentOnLastLine();
  await page
    .getByRole('textbox', { name: 'Comment', exact: true })
    .fill('Keep the last row and its thread above the next section.');
  await page.keyboard.press('Control+Enter');
  await expect(
    page.getByRole('article', { name: 'Comment thread', exact: true }),
  ).toBeVisible();
  for (const width of [1080, 800, 1440, 414]) {
    await page.setViewportSize({ width, height: 900 });
    await existing.scrollIntoViewIfNeeded();
    await expect
      .poll(() => code.read(), {
        message: `Diffs and threads must end above the next section at ${width}px`,
      })
      .toMatchObject({ files: 6, notes: 6, overlaps: [] });
  }
});

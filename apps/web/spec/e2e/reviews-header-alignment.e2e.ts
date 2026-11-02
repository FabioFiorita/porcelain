import { reviewHeaders } from '../kit/review-header.ts';
import { expect, test } from './fixtures.ts';

test('decision file headers keep comments, counts and file navigation centered as paths truncate', async ({
  pairedPage: page,
  app,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId) throw new Error('Missing published review');
  await page.setViewportSize({ width: 1440, height: 900 });
  await app.open(`/reviews/${published.reviewId}`);
  await page
    .getByRole('button', {
      name: 'Go to 2. Revoke access across devices',
      exact: true,
    })
    .click();
  for (const width of [800, 1440, 1080, 721, 720, 414, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => reviewHeaders(page, width >= 720), {
        message: `Header controls must share the path's center and fit at ${width}px`,
      })
      .toEqual({ files: 6, misaligned: [] });
  }
});

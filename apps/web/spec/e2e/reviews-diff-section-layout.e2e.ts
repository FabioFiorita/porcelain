import { expect, test } from './fixtures.ts';

test('decision code slices remain separate and open the retained file at every width', async ({
  pairedPage: page,
  app,
  agent,
  server,
}) => {
  await agent.publishArchitecture();
  const published = (await server.publishedReview()).review;
  if (!published?.reviewId) throw new Error('Missing published review');
  await app.open(`/reviews/${published.reviewId}`);
  await page.getByRole('button', { name: /^1\. Invite a teammate · / }).click();
  const slices = page.getByRole('region', { name: 'Code slices', exact: true });
  const articles = slices.getByRole('article');
  await expect(articles).toHaveCount(7);
  for (const width of [1080, 800, 1440, 414]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        articles.evaluateAll((nodes) =>
          nodes.every((node, index) => {
            const bounds = node.getBoundingClientRect();
            const previous = nodes[index - 1]?.getBoundingClientRect();
            return (
              bounds.width > 0 &&
              bounds.left >= 0 &&
              bounds.right <= node.ownerDocument.documentElement.clientWidth &&
              (!previous || bounds.top >= previous.bottom)
            );
          }),
        ),
      )
      .toBe(true);
  }
  await slices
    .getByRole('button', {
      name: /^Open apps\/web\/src\/invite-member\.ts at line [0-9]+$/,
    })
    .click();
  await expect(
    page.getByRole('tab', {
      name: 'apps/web/src/invite-member.ts',
      exact: true,
    }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('button', { name: 'Back to the walkthrough', exact: true }),
  ).toBeVisible();
});

import { expect, test } from './fixtures.tsx';

test('compact retained code scrolls to the last line inside its rounded card', async ({
  agent,
  repo,
  server,
  render,
  reviewLayout,
}) => {
  await repo.write(
    repo.readme.path,
    `${Array.from({ length: 80 }, (_, index) => `Retained line ${index + 1}`).join('\n')}\n`,
  );
  await repo.commit('Prepare long retained code');
  await agent.publishReview('Read retained code', 'context');
  const review = (await server.publishedReview()).review;
  if (!review) throw new Error('The fixture must publish a review');
  const app = await render.route(`/reviews/${review.reviewId}`);
  await app.page
    .getByRole('button', { name: 'Continue at decision 1', exact: true })
    .click();
  const code = app.page
    .getByRole('region', { name: 'Existing code it relies on', exact: true })
    .getByRole('region', { name: 'Code content', exact: true });
  await expect
    .poll(() => reviewLayout.compactCodeFrame(code))
    .toEqual({
      border: '1px',
      radius: true,
      bounded: true,
      scrolls: true,
    });
  reviewLayout.scrollCodeTo(code, 100000);
  await expect
    .poll(() => reviewLayout.codeScrollTop(code))
    .toBeGreaterThan(1000);
  await expect
    .poll(() => reviewLayout.codeLineInsideFrame(code, 80))
    .toBe(true);
});

import { expect, test } from './fixtures.tsx';

test('a context slice shows its saved range and opens the complete retained file', async ({
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
  const slice = app.page.getByRole('article', {
    name: 'Step New line',
    exact: true,
  });
  await expect
    .element(slice.getByText('Retained line 3', { exact: true }))
    .toBeVisible();
  await expect
    .element(slice.getByText('Retained line 80', { exact: true }))
    .not.toBeInTheDocument();
  await slice
    .getByRole('button', { name: 'Open README.md at line 3', exact: true })
    .click();
  await expect
    .element(app.page.getByRole('tab', { name: 'README.md', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  const full = app.page.getByRole('region', {
    name: 'Code content',
    exact: true,
  });
  await expect.element(full).toBeVisible();
  reviewLayout.scrollCodeTo(full, 100000);
  await expect
    .element(app.page.getByText('Retained line 80', { exact: true }))
    .toBeInTheDocument();
});

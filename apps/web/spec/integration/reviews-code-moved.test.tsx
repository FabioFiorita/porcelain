import { expect, test } from './fixtures.tsx';

test('editing explained code shows the amber decision badge and briefing line', async ({
  agent,
  render,
  repo,
  server,
}) => {
  await agent.publishReview('Readme decision');
  const published = (await server.publishedReview()).review;
  const reviewId = published?.reviewId;
  if (reviewId === undefined) throw new Error('The fixture has no review');
  const { page } = await render.route(`/reviews/${reviewId}`);
  const review = page.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await expect
    .element(review.getByText('1 decision has code moved', { exact: true }))
    .not.toBeInTheDocument();
  await repo.write(
    repo.readme.path,
    `${repo.readme.committed}Changed after the explanation.\n`,
  );
  await expect
    .element(review.getByText('1 decision has code moved', { exact: true }))
    .toBeVisible();
  await review
    .getByRole('button', { name: '1. Readme decision · Docs', exact: true })
    .click();
  const badge = review.getByText('Code moved since it was explained', {
    exact: true,
  });
  await expect.element(badge).toBeVisible();
  await expect.element(badge).toHaveAttribute('data-variant', 'warn');
  await repo.write(repo.readme.path, repo.readme.changed);
  await expect.element(badge).not.toBeInTheDocument();
});

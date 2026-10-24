import { expect, test } from './fixtures.tsx';

test('marking a retained decision marks its files, live edits preserve them, and unmarking keeps the files', async ({
  agent,
  repo,
  render,
  server,
}) => {
  await agent.publishReview('Readme layer');
  const published = (await server.publishedReview()).review;
  const layerId = published?.layers[0]?.id;
  const workspace = await render.workspace();
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review
    .getByRole('button', { name: '1. Readme layer · Docs', exact: true })
    .click();
  const stop = review.getByRole('region', {
    name: '1. Readme layer',
    exact: true,
  });
  await stop
    .getByRole('button', { name: 'Mark decision reviewed', exact: true })
    .click();
  await expect
    .element(
      stop.getByRole('button', { name: 'Decision reviewed', exact: true }),
    )
    .toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({
      files: [{ path: repo.readme.path }],
      decisions: [{ layerId }],
    });
  await repo.write(repo.readme.path, 'A different live version.\n');
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({
      files: [{ path: repo.readme.path }],
      decisions: [{ layerId }],
    });
  await expect
    .element(stop.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await expect
    .element(stop.getByText('A different live version.', { exact: true }))
    .not.toBeInTheDocument();
  await stop
    .getByRole('button', { name: 'Decision reviewed', exact: true })
    .click();
  await expect
    .poll(() => server.branchReviewMarks())
    .toMatchObject({ files: [{ path: repo.readme.path }], decisions: [] });
  await expect
    .poll(async () => (await server.reviewedFiles()).marks)
    .toEqual([]);
});

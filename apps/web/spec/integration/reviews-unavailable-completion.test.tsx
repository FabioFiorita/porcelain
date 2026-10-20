import { expect, test } from './fixtures.tsx';

test('later uncommitted and unreadable paths do not enter a retained decision or block its completion', async ({
  agent,
  render,
  repo,
  server,
}) => {
  await agent.publishReview('Readable decision');
  const workspace = await render.workspace();
  await repo.write('a.ts', 'export const newer = true;\n');
  await repo.fifo('unreadable.txt');
  const review = workspace.getByRole('region', {
    name: 'Review walkthrough',
    exact: true,
  });
  await review
    .getByRole('button', { name: '1. Readable decision', exact: true })
    .click();
  const stop = review.getByRole('region', {
    name: '1. Readable decision',
    exact: true,
  });
  await expect
    .element(stop.getByText('unreadable.txt', { exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(stop.getByText('a.ts', { exact: true }))
    .not.toBeInTheDocument();
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
    .toMatchObject({ files: [{ path: repo.readme.path }] });
});

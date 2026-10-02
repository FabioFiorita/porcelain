import { expect, test } from './fixtures.tsx';

test('marking a published layer reviewed keeps the mark, a change to its code asks for review again, and unmarking removes it', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  const title = 'Readme layer';
  const marks = async () =>
    (await server.reviewedLayers()).marks.map((mark) =>
      mark.stale ? 'stale' : 'reviewed',
    );

  await agent.publishReview(title);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('button', { name: new RegExp(title) }).click();
  const layer = workspace.getByRole('region', {
    name: `Review layer ${title}`,
    exact: true,
  });
  const mark = layer.getByRole('button', {
    name: 'Mark layer reviewed',
    exact: true,
  });
  const reviewed = layer.getByRole('button', { name: 'Reviewed', exact: true });
  await expect.element(mark).toBeEnabled();
  await expect.poll(marks).toEqual([]);
  await mark.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(marks).toEqual(['reviewed']);

  await repo.write(
    repo.readme.path,
    `${repo.readme.committed}\nA revised change to review.\n`,
  );
  await expect
    .element(
      layer.getByText('Code changed since the review was written.', {
        exact: true,
      }),
    )
    .toBeVisible();
  const markChanged = layer.getByRole('button', {
    name: 'Mark changed layer reviewed',
    exact: true,
  });
  await expect.element(markChanged).toBeEnabled();
  await expect.poll(marks).toEqual(['stale']);
  await markChanged.click();
  await expect.element(reviewed).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(marks).toEqual(['reviewed']);

  await reviewed.click();
  await expect.element(mark).toBeEnabled();
  await expect.poll(marks).toEqual([]);
});

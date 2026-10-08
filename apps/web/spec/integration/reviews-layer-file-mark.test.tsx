import { expect, test } from './fixtures.tsx';

test('walkthrough files can be reviewed individually without marking the layer; graph excerpts cannot mark whole files', async ({
  workspace,
  repo,
  server,
  agent,
}) => {
  const title = 'Readme layer';
  const readme = repo.readme.path;
  const marked = async () =>
    (await server.reviewedFiles()).marks.map((mark) => mark.path);
  await agent.publishReview(title);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace.getByRole('button', { name: new RegExp(title) }).click();
  const layer = workspace.getByRole('region', {
    name: `Review layer ${title}`,
    exact: true,
  });
  const mark = workspace.getByRole('button', {
    name: `Mark ${readme} as reviewed`,
    exact: true,
  });
  const unmark = workspace.getByRole('button', {
    name: `Unmark ${readme} as unreviewed`,
    exact: true,
  });
  await layer.getByText('Agent note · New line', { exact: true }).click();
  await expect
    .element(layer.getByText('A line is added', { exact: true }))
    .toBeVisible();
  await mark.click();
  await expect.element(unmark).toBeEnabled();
  await expect.poll(marked).toContain(readme);
  await expect
    .poll(async () => (await server.reviewedLayers()).marks)
    .toEqual([]);
  await unmark.click();
  await expect.element(mark).toBeEnabled();
  await expect.poll(marked).not.toContain(readme);
  await layer.getByRole('tab', { name: 'Graph', exact: true }).click();
  await layer.getByRole('button', { name: 'New line', exact: true }).click();
  const code = layer.getByRole('region', {
    name: 'Selected step code',
    exact: true,
  });
  await expect
    .element(
      code.getByRole('button', {
        name: `Mark ${readme} as reviewed`,
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await code.getByText('Agent note', { exact: true }).click();
  await expect
    .element(code.getByText('A line is added', { exact: true }))
    .toBeVisible();
  await code
    .getByRole('button', { name: 'Show all changes in this file', exact: true })
    .click();
  await expect.element(mark).toBeEnabled();
});

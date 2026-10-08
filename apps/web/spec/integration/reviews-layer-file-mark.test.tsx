import { expect, test } from './fixtures.tsx';

test('an excerpt cannot mark a whole file reviewed; opening its complete changes permits an explicit file mark', async ({
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
  await expect
    .element(
      layer.getByRole('button', {
        name: `Mark ${readme} as reviewed`,
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await layer
    .getByRole('button', { name: 'Show all changes in this file', exact: true })
    .click();
  const mark = workspace.getByRole('button', {
    name: `Mark ${readme} as reviewed`,
    exact: true,
  });
  const unmark = workspace.getByRole('button', {
    name: `Unmark ${readme} as unreviewed`,
    exact: true,
  });
  await mark.click();
  await expect.element(unmark).toBeEnabled();
  await expect.poll(marked).toContain(readme);
  await unmark.click();
  await expect.element(mark).toBeEnabled();
  await expect.poll(marked).not.toContain(readme);
});

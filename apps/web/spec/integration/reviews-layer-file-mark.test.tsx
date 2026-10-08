import { expect, test } from './fixtures.tsx';

test('a file inside a published layer is marked and unmarked reviewed on its own, like any changed file', async ({
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
  const mark = layer.getByRole('button', {
    name: `Mark ${readme} as reviewed`,
    exact: true,
  });
  const unmark = layer.getByRole('button', {
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

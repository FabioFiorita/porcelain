import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('walkthrough files can be reviewed individually without marking the layer; graph dialogs review complete files without leaving the graph', async ({
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
  const code = workspace.getByRole('dialog', { name: 'New line', exact: true });
  await expect
    .element(
      code.getByRole('button', {
        name: `Mark ${readme} as reviewed`,
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect.poll(marked).not.toContain(readme);
  await code.getByText('Agent note · New line', { exact: true }).click();
  await expect
    .element(code.getByText('A line is added', { exact: true }))
    .toBeVisible();
  await code
    .getByRole('button', { name: `Mark ${readme} as reviewed`, exact: true })
    .click();
  await expect.poll(marked).toEqual([readme]);
  await expect
    .poll(async () => (await server.reviewedLayers()).marks)
    .toEqual([]);
  await code.getByRole('button', { name: 'Close', exact: true }).click();
  await expect
    .element(layer.getByRole('tab', { name: 'Graph', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('r');
  await expect.poll(marked).toEqual([readme]);
});

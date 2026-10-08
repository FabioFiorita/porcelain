import { expect, test } from './fixtures.tsx';

test('opening the graph of a published layer draws its lane and step, and choosing the step shows its code beside the graph', async ({
  workspace,
  agent,
}) => {
  const title = 'Readme layer';

  await agent.publishReview(title);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Review', exact: true }).click();
  await workspace.getByRole('button', { name: new RegExp(title) }).click();
  const layer = workspace.getByRole('region', {
    name: `Review layer ${title}`,
    exact: true,
  });
  const graphTab = layer.getByRole('tab', { name: 'Graph', exact: true });
  await graphTab.click();
  await expect.element(graphTab).toHaveAttribute('aria-selected', 'true');

  const step = layer.getByRole('button', { name: 'New line', exact: true });
  await expect.element(step).toBeVisible();
  await expect
    .element(step.getByText('A line is added', { exact: true }))
    .not.toBeInTheDocument();
  await expect.element(layer.getByText('Docs', { exact: true })).toBeVisible();
  await expect
    .element(layer.getByText('Loading diagram…', { exact: true }))
    .not.toBeInTheDocument();

  await step.click();
  await expect
    .element(layer.getByText('Agent note', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      layer.getByRole('region', { name: 'Selected step code', exact: true }),
    )
    .toBeVisible();
});

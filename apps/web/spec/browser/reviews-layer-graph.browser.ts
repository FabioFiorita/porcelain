import { expect } from 'vitest';
import { test } from '../kit/journey';

test('opening the graph of a published layer draws its lane and step, and choosing the step shows its code beside the graph', async ({
  pairedPage,
  agent,
}) => {
  const title = 'Readme layer';

  await agent.publishReview(title);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('button', { name: new RegExp(title) }).click();
  const layer = pairedPage.getByRole('region', {
    name: `Review layer ${title}`,
  });
  const graphTab = layer.getByRole('tab', { name: 'Graph' });
  await graphTab.click();
  await expect.element(graphTab).toHaveAttribute('aria-selected', 'true');

  const step = layer.getByRole('button', { name: 'New line', exact: true });
  await expect.element(step).toBeVisible();
  await expect.element(step.getByText('A line is added')).toBeVisible();
  await expect.element(layer.getByText('Docs', { exact: true })).toBeVisible();
  await expect
    .element(layer.getByText('Loading diagram…'))
    .not.toBeInTheDocument();

  await step.click();
  await expect
    .element(layer.getByRole('region', { name: 'Selected step code' }))
    .toBeVisible();
});

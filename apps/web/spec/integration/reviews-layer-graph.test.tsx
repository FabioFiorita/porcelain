import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('opening the graph of a published layer draws its lane and step, and choosing a step opens its diff in a dialog without leaving the graph', async ({
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
  const code = workspace.getByRole('dialog', { name: 'New line', exact: true });
  await expect.element(code).toBeVisible();
  await expect
    .element(
      code.getByRole('button', {
        name: 'Mark README.md as reviewed',
        exact: true,
      }),
    )
    .toBeEnabled();
  await expect
    .element(
      code.getByText(
        '1 changed files · All changes in these files · 0 existing code locations',
        { exact: true },
      ),
    )
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(code).not.toBeInTheDocument();
  await expect.element(graphTab).toHaveAttribute('aria-selected', 'true');
  await expect.element(step).toHaveAttribute('aria-pressed', 'true');
  await expect.element(step).toHaveFocus();
});

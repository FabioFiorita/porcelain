import { expect } from 'vitest';
import { test } from '../kit/journey';

test('with every tab closed, the empty pane opens all changes, and the summary once the agent has published a review', async ({
  pairedPage,
  agent,
}) => {
  const closeChanges = pairedPage.getByRole('button', {
    name: 'Close Changes',
    exact: true,
  });
  await closeChanges.click();
  await expect
    .element(pairedPage.getByText('Nothing open', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      pairedPage.getByRole('button', { name: 'Open summary', exact: true }),
    )
    .not.toBeInTheDocument();
  await pairedPage
    .getByRole('button', { name: 'Open all changes', exact: true })
    .click();
  await expect.element(closeChanges).toBeVisible();
  await expect
    .element(pairedPage.getByText('Nothing open', { exact: true }))
    .not.toBeInTheDocument();

  await agent.publishReview('Readme layer');
  await closeChanges.click();
  await expect
    .element(
      pairedPage.getByRole('button', { name: 'Open all changes', exact: true }),
    )
    .not.toBeInTheDocument();
  await pairedPage
    .getByRole('button', { name: 'Open summary', exact: true })
    .click();
  await expect
    .element(
      pairedPage.getByRole('region', { name: 'Published review', exact: true }),
    )
    .toBeVisible();
});

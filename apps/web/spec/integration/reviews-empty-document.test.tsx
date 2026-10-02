import { expect, test } from './fixtures.tsx';

test('with every tab closed, the empty pane opens all changes, and the summary once the agent has published a review', async ({
  workspace,
  agent,
}) => {
  const closeChanges = workspace.getByRole('button', {
    name: 'Close Changes',
    exact: true,
  });
  await closeChanges.click();
  await expect
    .element(workspace.getByText('Nothing open', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Open summary', exact: true }),
    )
    .not.toBeInTheDocument();
  await workspace
    .getByRole('button', { name: 'Open all changes', exact: true })
    .click();
  await expect.element(closeChanges).toBeVisible();
  await expect
    .element(workspace.getByText('Nothing open', { exact: true }))
    .not.toBeInTheDocument();

  await agent.publishReview('Readme layer');
  await closeChanges.click();
  await expect
    .element(
      workspace.getByRole('button', { name: 'Open all changes', exact: true }),
    )
    .not.toBeInTheDocument();
  await workspace
    .getByRole('button', { name: 'Open summary', exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('region', { name: 'Published review', exact: true }),
    )
    .toBeVisible();
});

import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('with every tab closed, the empty pane opens all changes, and the review once the agent has published one', async ({
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
      workspace.getByRole('button', { name: 'Open review', exact: true }),
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
    .getByRole('button', { name: 'Open review', exact: true })
    .click();
  await expect
    .element(
      workspace.getByRole('region', {
        name: 'Review walkthrough',
        exact: true,
      }),
    )
    .toBeVisible();
});

for (const surface of ['Files', 'History'] as const) {
  test(`a clean worktree opens ${surface} from its empty notice`, async ({
    repo,
    render,
  }) => {
    await repo.commit('Commit the sample change');
    const workspace = await render.workspace();
    await expect
      .element(
        workspace.getByRole('heading', {
          name: 'No changes to review',
          exact: true,
        }),
      )
      .toBeVisible();
    await workspace.getByRole('button', { name: surface, exact: true }).click();
    await expect
      .element(
        workspace.getByRole('tab', {
          name: surface,
          selected: true,
          exact: true,
        }),
      )
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect
      .element(workspace.getByRole('button', { name: surface, exact: true }))
      .toHaveFocus();
  });
}

import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('review groups collapse and expand all from their context menu and keyboard menu button', async ({
  workspace,
  repo,
}) => {
  await repo.write('phone-otp.spec.ts', 'test fixture\n');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace
    .getByRole('complementary', { name: 'Review sidebar', exact: true })
    .getByRole('tab', { name: 'Changes', exact: true })
    .click();
  const sidebar = workspace.getByRole('complementary', {
    name: 'Review sidebar',
    exact: true,
  });
  const row = sidebar.getByRole('button', { name: /^README.md ·/ });
  await expect.element(row).toBeVisible();
  const group = sidebar.getByRole('button', {
    name: 'Changed files',
    exact: true,
  });
  await expect.element(group).toBeVisible();
  await group.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Collapse all', exact: true })
    .click();
  await expect.element(row).not.toBeInTheDocument();
  const actions = sidebar.getByRole('button', {
    name: 'Actions for Changed files',
    exact: true,
  });
  await actions.click();
  await userEvent.keyboard('{Escape}');
  await expect.element(workspace.getByRole('menu')).not.toBeInTheDocument();
  await expect.element(actions).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await workspace
    .getByRole('menuitem', { name: 'Expand all', exact: true })
    .click();
  await expect.element(row).toBeVisible();
  await expect
    .element(sidebar.getByRole('button', { name: /^phone-otp.spec.ts ·/ }))
    .toBeVisible();
});

import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('opening the Git menu focuses the menu, not the branch label', async ({
  workspace,
}) => {
  await workspace
    .getByRole('button', { name: 'Git actions', exact: true })
    .click();
  const menu = workspace.getByRole('menu');
  await expect
    .element(menu.getByText('No upstream', { exact: true }))
    .toBeVisible();
  await expect.element(menu).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  await expect
    .element(menu.getByRole('menuitem', { name: /^Commit/ }))
    .toHaveFocus();
});

test('with changes to commit, the Git menu offers Commit at once and adds the rows that depend on the branch status together, so no row moves under the pointer', async ({
  render,
  fetchGate,
}) => {
  const held = fetchGate.holdNextGitStatusRead();
  const page = await render.workspace();
  held.arm();
  await page.getByRole('button', { name: 'Git actions', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect.poll(() => held.held()).toBe(true);
  await expect
    .element(menu.getByRole('status'))
    .toHaveTextContent('Reading Git status…');
  await expect
    .element(menu.getByRole('menuitem', { name: 'Commit…', exact: true }))
    .toBeVisible();
  await expect
    .element(menu.getByRole('menuitem', { name: /^Push/ }))
    .not.toBeInTheDocument();
  await expect
    .element(menu.getByRole('menuitem', { name: /^Stash changes/ }))
    .not.toBeInTheDocument();
  held.release();
  await expect
    .element(menu.getByRole('menuitem', { name: /^Stash changes/ }))
    .toBeVisible();
  await expect
    .element(menu.getByRole('menuitem', { name: /^Pop stash/ }))
    .toHaveTextContent('Pop stashNo stash is available.');
  await expect
    .element(menu.getByRole('menuitem', { name: 'Push', exact: true }))
    .toBeVisible();
  await expect.element(menu.getByRole('status')).not.toBeInTheDocument();
});

test('the commit dialog skips the branch label and one Escape closes it back to its opener', async ({
  workspace,
}) => {
  const opener = workspace.getByRole('button', { name: 'Commit', exact: true });
  await opener.click();
  const dialog = workspace.getByRole('dialog', {
    name: 'Commit changes',
    exact: true,
  });
  await expect
    .element(dialog.getByText('No upstream', { exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('button', { name: 'Close', exact: true }))
    .toHaveFocus();
  await userEvent.tab();
  await expect
    .element(dialog.getByRole('tab', { name: 'Single commit', exact: true }))
    .toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(opener).toHaveFocus();
});

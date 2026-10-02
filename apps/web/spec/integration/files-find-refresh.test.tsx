import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('the find count follows a file that changes on disk and stays within its matches', async ({
  workspace,
  repo,
}) => {
  const path = 'notes.txt';
  await repo.write(path, 'needle one\nneedle two\nneedle three\n');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await expect
    .element(workspace.getByText('needle three', { exact: true }))
    .toBeVisible();

  await userEvent.keyboard('{ControlOrMeta>}f{/ControlOrMeta}');
  await workspace
    .getByRole('textbox', { name: 'Find in file', exact: true })
    .fill('needle');
  await userEvent.keyboard('{Enter}{Enter}');
  await expect
    .element(workspace.getByText('3 of 3', { exact: true }))
    .toBeVisible();

  await repo.write(path, 'needle only\n');
  await expect
    .element(workspace.getByText('needle only', { exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByText('1 of 1', { exact: true }))
    .toBeVisible();
});

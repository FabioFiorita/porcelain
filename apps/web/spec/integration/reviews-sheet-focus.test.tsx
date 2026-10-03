import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('finding in a file opened from the review sheet keeps focus while the sheet closes', async ({
  workspace,
  repo,
}) => {
  const path = 'notes.txt';
  await repo.write(path, 'needle one\nneedle two\n');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await userEvent.keyboard('{ControlOrMeta>}f{/ControlOrMeta}');
  const find = workspace.getByRole('textbox', {
    name: 'Find in file',
    exact: true,
  });
  await expect.element(find).toHaveFocus();
  await expect
    .element(
      workspace.getByRole('dialog', { name: 'Worktree review', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect.element(find).toHaveFocus();
  await userEvent.keyboard('needle');
  await expect.element(find).toHaveValue('needle');
});

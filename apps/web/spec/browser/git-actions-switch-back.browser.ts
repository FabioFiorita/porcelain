import { expect } from 'vitest';
import { test } from '../kit/journey';

const side = 'journey-side';

test('switching back to the branch the worktree started on moves the worktree onto it again', async ({
  pairedPage,
  repo,
  server,
}) => {
  await repo.branch(side);
  await repo.switch(side);
  await expect.poll(async () => (await server.branches()).current).toBe(side);
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await expect
    .element(pairedPage.getByRole('menu').getByText(side, { exact: true }))
    .toBeVisible();
  await pairedPage.getByRole('menuitem', { name: /^Switch branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Switch branch' });
  const branches = dialog.getByRole('combobox', { name: 'Branch' });
  await expect
    .element(branches.getByRole('option', { name: `${side} · current` }))
    .toBeDisabled();
  await branches.selectOptions(repo.initialBranch);
  await dialog.getByRole('button', { name: 'Switch branch' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.branches()).current)
    .toBe(repo.initialBranch);
});

import { expect } from 'vitest';
import { test } from '../kit/journey';

const feature = 'journey-feature';
const diverged = 'journey-diverged';
const notes = 'notes.md';

test('switching to another branch lists the local branches and moves the worktree onto the chosen one', async ({
  pairedPage,
  repo,
  server,
}) => {
  const start = (await server.branches()).current;
  await repo.branch(feature);
  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Switch branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Switch branch' });
  const branches = dialog.getByRole('combobox', { name: 'Branch' });
  await expect
    .element(branches.getByRole('option', { name: `${start} · current` }))
    .toBeDisabled();
  await branches.selectOptions(feature);
  await dialog.getByRole('button', { name: 'Switch branch' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.branches()).current)
    .toBe(feature);
  await expect
    .poll(async () => (await server.gitStatus()).branch?.name)
    .toBe(feature);
});

test('switching is refused with what Git said when it would overwrite a local file, and the worktree stays put', async ({
  pairedPage,
  repo,
  server,
}) => {
  await repo.branch(diverged);
  await repo.switch(diverged);
  await repo.write(notes, 'Committed on the diverged branch\n');
  await repo.commit('Add notes on the diverged branch');
  await repo.switch(feature);
  await repo.write(notes, 'Local notes that are not committed\n');
  await expect
    .element(
      pairedPage.getByRole('button', { name: `Mark ${notes} as reviewed` }),
    )
    .toBeVisible();

  await pairedPage.getByRole('button', { name: 'Git actions' }).click();
  await pairedPage.getByRole('menuitem', { name: /^Switch branch/ }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Switch branch' });
  await dialog
    .getByRole('combobox', { name: 'Branch' })
    .selectOptions(diverged);
  await dialog.getByRole('button', { name: 'Switch branch' }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/untracked working tree files would be overwritten/);
  await expect.element(dialog).toBeVisible();
  await expect
    .poll(async () => (await server.branches()).current)
    .toBe(feature);
  await expect
    .poll(async () => (await server.text(notes)).text)
    .toBe('Local notes that are not committed\n');
});

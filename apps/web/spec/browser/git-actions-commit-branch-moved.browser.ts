import { expect } from 'vitest';
import { test } from '../kit/journey';

const moved = 'journey-moved';

test('a commit is refused when the worktree switched branch after the dialog opened, even on the same commit', async ({
  pairedPage,
  repo,
  server,
}) => {
  const newest = (await server.commits()).commits[0]?.subject;
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Commit changes' });
  await expect
    .element(dialog.getByText(repo.initialBranch, { exact: true }))
    .toBeVisible();

  await repo.branch(moved);
  await repo.switch(moved);
  await expect.element(dialog.getByText(moved, { exact: true })).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Message' }).fill('Moved commit');
  await dialog.getByRole('button', { name: 'Commit selected files' }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/changed since looked/i);
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(newest);
  await expect.poll(async () => (await server.branches()).current).toBe(moved);
});

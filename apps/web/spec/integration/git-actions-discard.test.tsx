import { expect, test } from './fixtures.tsx';

test('discarding a changed file returns it to the last commit, and Restore brings the change back', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const saved = async () => (await server.text(readme)).text;
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace
    .getByRole('button', { name: `${readme} · unstaged`, exact: true })
    .click();
  await workspace
    .getByRole('button', { name: `Discard changes to ${readme}`, exact: true })
    .click();
  const dialog = workspace.getByRole('alertdialog', {
    name: `Discard ${readme}?`,
    exact: true,
  });
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect
    .element(workspace.getByText(`Discarded ${readme}`, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toBe(repo.readme.committed);

  await workspace.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect
    .element(workspace.getByText(`Restored ${readme}`, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toBe(repo.readme.changed);
});

test('discarding a file that changed after the dialog opened is refused and keeps the newer text', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const newer = 'Changed on disk after the discard dialog opened\n';
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Changes', exact: true }).click();
  await workspace
    .getByRole('button', { name: `${readme} · unstaged`, exact: true })
    .click();
  await workspace
    .getByRole('button', { name: `Discard changes to ${readme}`, exact: true })
    .click();
  const dialog = workspace.getByRole('alertdialog', {
    name: `Discard ${readme}?`,
    exact: true,
  });
  await expect.element(dialog).toBeVisible();
  await repo.write(readme, newer);
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/Look at the diff again before discarding\./);
  await expect
    .element(dialog.getByRole('button', { name: 'Look again', exact: true }))
    .toBeVisible();
  await expect.poll(async () => (await server.text(readme)).text).toBe(newer);
});

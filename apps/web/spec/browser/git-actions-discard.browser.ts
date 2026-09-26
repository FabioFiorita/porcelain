import { expect } from 'vitest';
import { test } from '../kit/journey';

test('discarding a changed file returns it to the last commit, and Restore brings the change back', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const saved = async () => (await server.text(readme)).text;
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: `${readme} · unstaged` })
    .click();
  await pairedPage
    .getByRole('button', { name: `Discard changes to ${readme}` })
    .click();
  const dialog = pairedPage.getByRole('alertdialog', {
    name: `Discard ${readme}?`,
  });
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect
    .element(pairedPage.getByText(`Discarded ${readme}`, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toBe(repo.readme.committed);

  await pairedPage
    .getByRole('button', { name: 'Restore', exact: true })
    .click();
  await expect
    .element(pairedPage.getByText(`Restored ${readme}`, { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toBe(repo.readme.changed);
});

test('discarding a file that changed after the dialog opened is refused and keeps the newer text', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const newer = 'Changed on disk after the discard dialog opened\n';
  await pairedPage
    .getByRole('button', { name: `Discard changes to ${readme}` })
    .click();
  const dialog = pairedPage.getByRole('alertdialog', {
    name: `Discard ${readme}?`,
  });
  await expect.element(dialog).toBeVisible();
  await repo.write(readme, newer);
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toMatchTextContent(/Look at the diff again before discarding\./);
  await expect
    .element(dialog.getByRole('button', { name: 'Look again' }))
    .toBeVisible();
  await expect.poll(async () => (await server.text(readme)).text).toBe(newer);
});

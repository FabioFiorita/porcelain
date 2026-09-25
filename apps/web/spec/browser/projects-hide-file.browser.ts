import { expect } from 'vitest';
import { test } from '../kit/journey';

test('hiding a file takes it out of the file tree and the server keeps it hidden for the project', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const hidden = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path);
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Hide file' }).click();

  await expect.element(file).not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByRole('button', { name: 'Hidden (1)' }))
    .toBeVisible();
  await expect.poll(hidden).toContain(readme);
});

test('showing a hidden file again returns it to the file tree and the server no longer hides it', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const hidden = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path);
  await pairedPage.getByRole('button', { name: 'Hidden (1)' }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Show file' }).click();

  await expect
    .element(pairedPage.getByRole('button', { name: 'Showing hidden' }))
    .not.toBeInTheDocument();
  await expect.element(file).toBeVisible();
  await expect.poll(hidden).not.toContain(readme);
});

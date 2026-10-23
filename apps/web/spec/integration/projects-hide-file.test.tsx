import { expect, test } from './fixtures.tsx';

test('hiding a file takes it out of the file tree and the server keeps it hidden for the project', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const hidden = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = workspace.getByRole('treeitem', { name: readme, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Hide file', exact: true })
    .click();

  await expect.element(file).not.toBeInTheDocument();
  const allFiles = workspace.getByRole('region', {
    name: 'All files',
    exact: true,
  });
  await expect
    .element(allFiles.getByText('1 hidden file', { exact: true }))
    .toBeVisible();
  await expect
    .element(allFiles.getByRole('button', { name: 'Show', exact: true }))
    .toHaveAttribute('aria-pressed', 'false');
  await expect.poll(hidden).toContain(readme);
});

test('showing a hidden file again returns it to the file tree and the server no longer hides it', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const hidden = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.path);
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: readme, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Hide file', exact: true })
    .click();
  const allFiles = workspace.getByRole('region', {
    name: 'All files',
    exact: true,
  });
  await allFiles.getByRole('button', { name: 'Show', exact: true }).click();
  const file = workspace.getByRole('treeitem', { name: readme, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Show file', exact: true })
    .click();

  await expect
    .element(allFiles.getByRole('button', { name: 'Hide', exact: true }))
    .not.toBeInTheDocument();
  await expect.element(file).toBeVisible();
  await expect.poll(hidden).not.toContain(readme);
});

import { expect, test } from './fixtures.tsx';

test('saving over a file that changed on disk is refused and keeps both texts', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const onDisk = 'Changed on disk while the browser edits\n';
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = workspace.getByRole('treeitem', { name: readme, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = workspace.getByRole('textbox', { name: readme, exact: true });
  await expect.element(editor).toBeVisible();

  await repo.write(readme, onDisk);
  await editor.fill('Browser edit made before the disk changed');
  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .element(workspace.getByRole('alert'))
    .toMatchTextContent(/The file changed on disk since you opened it\./);
  await expect
    .element(
      workspace.getByText('Not saving: changed on disk', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(workspace.getByRole('button', { name: 'Done', exact: true }))
    .toBeDisabled();
  await expect.poll(() => server.fileWriteCount()).toBe(1);
  await expect.poll(async () => (await server.text(readme)).text).toBe(onDisk);
});

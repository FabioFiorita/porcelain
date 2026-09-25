import { expect } from 'vitest';
import { test } from '../kit/journey';

test('saving over a file that changed on disk is refused and keeps both texts', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const onDisk = 'Changed on disk while the browser edits\n';
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Open file' }).click();
  await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = pairedPage.getByRole('textbox', { name: readme });
  await expect.element(editor).toBeVisible();

  await repo.write(readme, onDisk);
  await editor.fill('Browser edit made before the disk changed');
  await pairedPage.getByRole('button', { name: 'Done' }).click();
  await expect
    .element(pairedPage.getByRole('alert'))
    .toMatchTextContent(/The file changed on disk since you opened it\./);
  await expect
    .element(pairedPage.getByText('Not saving: changed on disk'))
    .toBeVisible();
  await expect.poll(async () => (await server.text(readme)).text).toBe(onDisk);
});

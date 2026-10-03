import { expect, test } from './fixtures.tsx';

test('a commit with a typed message succeeds and becomes the newest commit', async ({
  workspace,
  server,
}) => {
  const message = 'Browser commit';
  await workspace.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = workspace.getByRole('dialog');
  await expect.element(dialog).toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill(message);
  await dialog
    .getByRole('button', { name: 'Commit selected files', exact: true })
    .click();
  await expect
    .element(dialog.getByText('succeeded', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(message);
});

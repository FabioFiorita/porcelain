import { expect } from 'vitest';
import { test } from '../kit/journey';

test('a commit with a typed message succeeds and becomes the newest commit', async ({
  pairedPage,
  server,
}) => {
  const message = 'Browser commit';
  await pairedPage.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = pairedPage.getByRole('dialog');
  await expect.element(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Message' }).fill(message);
  await dialog.getByRole('button', { name: 'Commit selected files' }).click();
  await expect.element(dialog.getByText('succeeded')).toBeVisible();
  await expect
    .poll(async () => (await server.commits()).commits[0]?.subject)
    .toBe(message);
});

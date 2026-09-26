import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('New file and New folder open inline names at phone width and create entries', async ({
  app,
  server,
}) => {
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files' }).click();
  await opened.getByRole('button', { name: 'New file' }).click();
  const fileName = opened.getByRole('textbox', { name: /rename/i });
  await expect.element(fileName).toBeVisible();
  await fileName.fill('phone-created.md');
  await userEvent.keyboard('{Enter}');
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .toContain('phone-created.md');
  await opened.getByRole('button', { name: 'New folder' }).click();
  const folderName = opened.getByRole('textbox', { name: /rename/i });
  await expect.element(folderName).toBeVisible();
  await folderName.fill('phone-folder');
  await userEvent.keyboard('{Enter}');
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .toContain('phone-folder');
});

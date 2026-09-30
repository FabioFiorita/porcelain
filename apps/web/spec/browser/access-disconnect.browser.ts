import { expect } from 'vitest';
import { test } from '../kit/journey';

test('disconnecting is refused while a file draft cannot be saved, and the file on disk keeps its own change', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const onDisk = 'Changed on disk before the browser disconnects\n';
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
  await editor.fill('A draft the browser cannot save');
  await expect
    .element(pairedPage.getByText('Not saving: changed on disk'))
    .toBeVisible();
  await expect.poll(() => server.fileWriteCount()).toBe(1);

  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await pairedPage
    .getByRole('main', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'Connection', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'Disconnect this browser' })
    .click();

  await expect
    .element(settings.getByRole('alert'))
    .toHaveTextContent(
      'Save or discard unsaved file drafts before disconnecting.',
    );
  await expect.poll(() => server.fileWriteCount()).toBe(1);
  await expect.poll(async () => (await server.text(readme)).text).toBe(onDisk);
}, 30_000);

test('disconnecting this browser ends its session and shows how to pair it again, while the device stays paired', async ({
  pairedPage,
  server,
}) => {
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect.element(settings).not.toBeInTheDocument();
  await pairedPage
    .getByRole('button', { name: 'Resume edit', exact: true })
    .click();
  await pairedPage.getByRole('button', { name: 'Reload' }).click();
  await expect
    .element(pairedPage.getByText('Not saving: changed on disk'))
    .not.toBeInTheDocument();

  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  await pairedPage
    .getByRole('main', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'Connection', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'Disconnect this browser' })
    .click();

  await expect
    .element(
      pairedPage.getByRole('heading', { name: 'This browser is not paired' }),
    )
    .toBeVisible();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toContain('Journey browser');
}, 30_000);

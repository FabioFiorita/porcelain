import { expect, test, type Page, type Repo } from './fixtures.ts';
import { replaceEditorContent } from '../kit/editor.ts';

async function refuseDisconnectWithDraft(page: Page, repo: Repo) {
  const readme = repo.readme.path;
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: readme, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Open file', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: readme, exact: true });
  await expect(editor).toBeVisible();
  await repo.write(readme, 'Changed on disk before the browser disconnects\n');
  await replaceEditorContent(editor, 'A draft the browser cannot save');
  await expect(
    page.getByText('Not saving: changed on disk', { exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveText('A draft the browser cannot save');
  await page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('main', { name: 'Settings', exact: true });
  await settings
    .getByRole('button', { name: 'Connection', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'Disconnect this browser', exact: true })
    .click();
  await expect(settings.getByRole('alert')).toHaveText(
    'Save or discard unsaved file drafts before disconnecting.',
  );
}

test('disconnecting is refused while a file draft cannot be saved, and the file on disk keeps its own change', async ({
  pairedPage,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const onDisk = 'Changed on disk before the browser disconnects\n';
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = pairedPage.getByRole('treeitem', { name: readme, exact: true });
  await expect(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = pairedPage.getByRole('textbox', { name: readme, exact: true });
  await expect(editor).toBeVisible();
  await repo.write(readme, onDisk);
  await replaceEditorContent(editor, 'A draft the browser cannot save');
  await expect(
    pairedPage.getByText('Not saving: changed on disk', { exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveText('A draft the browser cannot save');
  await expect.poll(() => server.fileWriteCount()).toBe(1);

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await pairedPage
    .getByRole('main', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'Connection', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'Disconnect this browser', exact: true })
    .click();

  await expect(settings.getByRole('alert')).toHaveText(
    'Save or discard unsaved file drafts before disconnecting.',
  );
  await expect.poll(() => server.fileWriteCount()).toBe(1);
  await expect.poll(async () => (await server.text(readme)).text).toBe(onDisk);
});

test('disconnecting this browser ends its session and shows how to pair it again, while the device stays paired', async ({
  pairedPage,
  repo,
  server,
}) => {
  await refuseDisconnectWithDraft(pairedPage, repo);
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await settings.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(settings).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Resume edit', exact: true })
    .click();
  await pairedPage.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(
    pairedPage.getByText('Not saving: changed on disk', { exact: true }),
  ).not.toBeAttached();
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe('Changed on disk before the browser disconnects\n');

  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await pairedPage
    .getByRole('main', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'Connection', exact: true })
    .click();
  await settings
    .getByRole('button', { name: 'Disconnect this browser', exact: true })
    .click();

  await expect(
    pairedPage.getByRole('heading', {
      name: 'This browser is not paired',
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toContain('Journey browser');
});

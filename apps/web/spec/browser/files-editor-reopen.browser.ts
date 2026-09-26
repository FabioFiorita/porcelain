import { expect } from 'vitest';
import { test } from '../kit/journey';

test('closing an editor saves its draft and reopening starts a fresh editor session', async ({
  pairedPage,
  repo,
  server,
}) => {
  const path = repo.readme.path;
  const openEditor = async () => {
    await pairedPage
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await pairedPage.getByRole('tab', { name: 'Files' }).click();
    const file = pairedPage.getByRole('treeitem', { name: path });
    await expect.element(file).toBeVisible();
    await file.click({ button: 'right' });
    await pairedPage.getByRole('menuitem', { name: 'Open file' }).click();
    await pairedPage.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = pairedPage.getByRole('textbox', { name: path });
    await expect.element(editor).toBeVisible();
    return editor;
  };

  const editor = await openEditor();
  await editor.fill('Closed editor marker');
  await pairedPage
    .getByRole('button', { name: `Close ${path}` })
    .last()
    .click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toContain('Closed editor marker');

  const reopened = await openEditor();
  await expect.element(reopened).toMatchTextContent(/Closed editor marker/);
  await expect
    .element(pairedPage.getByText('Saves as you pause', { exact: true }))
    .toBeVisible();
  await reopened.fill('Reopened editor marker');
  await pairedPage.getByRole('button', { name: 'Done' }).click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toContain('Reopened editor marker');
});

test('an editor keeps its draft ownership while the file opens in another pane', async ({
  pairedPage,
  repo,
}) => {
  const path = repo.readme.path;
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files' }).click();
  const file = pairedPage.getByRole('treeitem', { name: path });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage.getByRole('menuitem', { name: 'Open file' }).click();
  await pairedPage.getByRole('tab', { name: new RegExp(path) }).click({
    button: 'right',
  });
  await pairedPage.getByRole('menuitem', { name: /Open to the side/ }).click();
  await pairedPage
    .getByRole('button', { name: 'Edit', exact: true })
    .first()
    .click();
  await expect
    .element(pairedPage.getByRole('textbox', { name: path }))
    .toBeVisible();
  await expect
    .element(pairedPage.getByRole('button', { name: 'Edit', exact: true }))
    .toBeDisabled();
  await expect
    .element(pairedPage.getByRole('button', { name: 'Done' }))
    .toBeVisible();
});

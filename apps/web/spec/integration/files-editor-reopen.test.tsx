import { expect, test } from './fixtures.tsx';

test('closing an editor saves its draft and reopening starts a fresh editor session', async ({
  workspace,
  repo,
  server,
}) => {
  const path = repo.readme.path;
  const openEditor = async () => {
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
    const file = workspace.getByRole('treeitem', { name: path, exact: true });
    await expect.element(file).toBeVisible();
    await file.click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Open file', exact: true })
      .click();
    await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = workspace.getByRole('textbox', { name: path, exact: true });
    await expect.element(editor).toBeVisible();
    return editor;
  };

  const editor = await openEditor();
  await editor.fill('Closed editor marker');
  await workspace
    .getByRole('button', { name: `Close ${path}`, exact: true })
    .last()
    .click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toContain('Closed editor marker');

  const reopened = await openEditor();
  await expect.element(reopened).toMatchTextContent(/Closed editor marker/);
  await expect
    .element(workspace.getByText('Saves as you pause', { exact: true }))
    .toBeVisible();
  await reopened.fill('Reopened editor marker');
  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toContain('Reopened editor marker');
});

test('an editor keeps its draft ownership while the file opens in another pane', async ({
  workspace,
  repo,
}) => {
  const path = repo.readme.path;
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = workspace.getByRole('treeitem', { name: path, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace.getByRole('tab', { name: new RegExp(path) }).click({
    button: 'right',
  });
  await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
  await workspace
    .getByRole('button', { name: 'Edit', exact: true })
    .first()
    .click();
  await expect
    .element(workspace.getByRole('textbox', { name: path, exact: true }))
    .toBeVisible();
  await expect
    .element(workspace.getByRole('button', { name: 'Edit', exact: true }))
    .toBeDisabled();
  await expect
    .element(workspace.getByRole('button', { name: 'Done', exact: true }))
    .toBeVisible();
});

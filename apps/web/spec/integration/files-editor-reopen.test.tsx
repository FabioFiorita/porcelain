import { userEvent } from 'vitest/browser';
import { expect, test, replaceEditorContent } from './fixtures.tsx';

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
  await replaceEditorContent(editor, 'Closed editor marker');
  await workspace
    .getByRole('button', { name: `Close ${path}`, exact: true })
    .last()
    .click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toBe('Closed editor marker');

  const reopened = await openEditor();
  await expect.element(reopened).toHaveTextContent('Closed editor marker');
  await expect
    .element(workspace.getByText('Saves as you pause', { exact: true }))
    .toBeVisible();
  await replaceEditorContent(reopened, 'Reopened editor marker');
  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toBe('Reopened editor marker');
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

test('two file editors keep one save shortcut owner while pane focus changes', async ({
  workspace,
  repo,
  server,
  tabShortcuts,
}) => {
  await repo.write('other.md', '# Other editor\n');
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace
    .getByRole('tab', { name: new RegExp(repo.readme.path) })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  await left.getByRole('button', { name: 'Edit', exact: true }).click();
  await right.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('treeitem', { name: 'other.md', exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await right.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = right.getByRole('textbox', { name: 'other.md', exact: true });
  await expect.element(editor).toBeVisible();
  await expect
    .element(left.getByRole('textbox', { name: repo.readme.path, exact: true }))
    .toBeVisible();
  await expect
    .poll(() => tabShortcuts.registered(['Mod+S']))
    .toEqual([['Mod+S', 'error']]);
  await replaceEditorContent(editor, 'Right editor saved');
  await userEvent.keyboard('{ControlOrMeta>}s{/ControlOrMeta}');
  await expect
    .poll(async () => (await server.text('other.md')).text)
    .toBe('Right editor saved');
  const otherEditor = left.getByRole('textbox', {
    name: repo.readme.path,
    exact: true,
  });
  await replaceEditorContent(otherEditor, 'Left editor saved');
  await userEvent.keyboard('{ControlOrMeta>}s{/ControlOrMeta}');
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe('Left editor saved');
  await expect
    .poll(() => tabShortcuts.registered(['Mod+S']))
    .toEqual([['Mod+S', 'error']]);
});

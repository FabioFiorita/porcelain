import { userEvent } from 'vitest/browser';
import { expect, test, replaceEditorContent } from './fixtures.tsx';

test.for(['pause', 'shortcut', 'Done', 'tab close'] as const)(
  'an edited file saves with %s',
  async (method, { workspace, repo, server }) => {
    const readme = repo.readme.path;
    const marker = `Browser ${method} marker`;
    await workspace
      .getByRole('button', { name: 'Review', exact: true })
      .click();
    await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
    const file = workspace.getByRole('treeitem', { name: readme, exact: true });
    await expect.element(file).toBeVisible();
    await file.click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Open file', exact: true })
      .click();
    await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = workspace.getByRole('textbox', {
      name: readme,
      exact: true,
    });
    await expect.element(editor).toBeVisible();
    await replaceEditorContent(editor, marker);
    if (method === 'pause')
      await expect
        .element(workspace.getByText('Saved', { exact: true }))
        .toBeVisible();
    if (method === 'shortcut')
      await userEvent.keyboard('{ControlOrMeta>}s{/ControlOrMeta}');
    if (method === 'Done') {
      await workspace
        .getByRole('button', { name: 'Done', exact: true })
        .click();
      await expect
        .element(workspace.getByRole('button', { name: 'Edit', exact: true }))
        .toBeVisible();
    }
    if (method === 'tab close')
      await workspace
        .getByRole('button', { name: `Close ${readme}`, exact: true })
        .last()
        .click();
    await expect
      .poll(async () => (await server.text(readme)).text)
      .toBe(marker);
    await expect.poll(() => server.fileWriteCount()).toBe(1);
    if (method !== 'shortcut') return;
    await replaceEditorContent(editor, 'Browser second shortcut marker');
    await userEvent.keyboard('{ControlOrMeta>}s{/ControlOrMeta}');
    await expect
      .poll(async () => (await server.text(readme)).text)
      .toBe('Browser second shortcut marker');
    await expect.poll(() => server.fileWriteCount()).toBe(2);
  },
);

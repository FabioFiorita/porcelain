import { userEvent } from 'vitest/browser';
import { expect, test, replaceEditorContent } from './fixtures.tsx';

test('an edited file saves after a pause, with Done and when its tab closes', async ({
  workspace,
  repo,
  server,
}) => {
  const readme = repo.readme.path;
  const saved = async () => (await server.text(readme)).text;
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = workspace.getByRole('treeitem', { name: readme, exact: true });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = workspace.getByRole('textbox', { name: readme, exact: true });
  await expect.element(editor).toBeVisible();

  await replaceEditorContent(editor, 'Browser autosave marker');
  await expect
    .element(workspace.getByText('Saved', { exact: true }))
    .toBeVisible();
  await expect.poll(saved).toBe('Browser autosave marker');
  await expect.poll(() => server.fileWriteCount()).toBe(1);

  await replaceEditorContent(editor, 'Browser shortcut marker');
  await userEvent.keyboard('{ControlOrMeta>}s{/ControlOrMeta}');
  await expect.poll(saved).toBe('Browser shortcut marker');
  await expect.poll(() => server.fileWriteCount()).toBe(2);

  await replaceEditorContent(editor, 'Browser done marker');
  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .element(workspace.getByRole('button', { name: 'Edit', exact: true }))
    .toBeVisible();
  await expect.poll(saved).toBe('Browser done marker');
  await expect.poll(() => server.fileWriteCount()).toBe(3);

  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  await replaceEditorContent(
    workspace.getByRole('textbox', { name: readme, exact: true }),
    'Browser close marker',
  );
  await workspace
    .getByRole('button', { name: `Close ${readme}`, exact: true })
    .last()
    .click();
  await expect.poll(saved).toBe('Browser close marker');
  await expect.poll(() => server.fileWriteCount()).toBe(4);
}, 30_000);

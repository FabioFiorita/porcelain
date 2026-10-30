import { page, userEvent } from 'vitest/browser';
import { expect, test, replaceEditorContent } from './fixtures.tsx';

test.for(['clean', 'unsaved'] as const)(
  'a disk update refreshes split file tabs with a %s draft without React errors',
  async (initial, { workspace, repo, server }) => {
    await page.viewport(1440, 900);
    await workspace
      .getByRole('navigation', { name: 'Side panel', exact: true })
      .getByRole('button', { name: 'Files', exact: true })
      .click();
    const path = repo.readme.path;
    await workspace
      .getByRole('treeitem', { name: path, exact: true })
      .click({ button: 'right' });
    await workspace
      .getByRole('menuitem', { name: 'Open file', exact: true })
      .click();
    await workspace
      .getByRole('tab', { name: path, exact: true })
      .click({ button: 'right' });
    await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
    const left = workspace.getByRole('region', {
      name: 'Left pane',
      exact: true,
    });
    const right = workspace.getByRole('region', {
      name: 'Right pane',
      exact: true,
    });
    const disk = 'Updated on disk while both tabs stay open.';
    if (initial === 'unsaved') {
      await left.getByRole('button', { name: 'Edit', exact: true }).click();
      await replaceEditorContent(
        left.getByRole('textbox', { name: path, exact: true }),
        'Keep my unsaved draft',
      );
    }
    await repo.write(path, disk);
    await expect.element(right.getByText(disk, { exact: true })).toBeVisible();
    if (initial === 'clean') {
      await expect.element(left.getByText(disk, { exact: true })).toBeVisible();
      await repo.write(path, '# Sample repository\n\nA change to review.\n');
      await expect
        .element(left.getByText('A change to review.', { exact: true }))
        .toBeVisible();
      await expect
        .element(right.getByText('A change to review.', { exact: true }))
        .toBeVisible();
      await left.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect
        .element(left.getByRole('textbox', { name: path, exact: true }))
        .toMatchTextContent(/A change to review\./);
      await left.getByRole('button', { name: 'Done', exact: true }).click();
    } else {
      await expect
        .element(left.getByRole('textbox', { name: path, exact: true }))
        .toHaveTextContent('Keep my unsaved draft');
      await left.getByRole('button', { name: 'Done', exact: true }).click();
      await expect
        .element(left.getByRole('alert'))
        .toMatchTextContent(/The file changed on disk since you opened it\./);
      await expect.poll(async () => (await server.text(path)).text).toBe(disk);
      await left.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect.element(left.getByText(disk, { exact: true })).toBeVisible();
    }
  },
);

test('an open clean editor follows restored disk text and reopens on it', async ({
  workspace,
  repo,
  server,
}) => {
  await page.viewport(1440, 900);
  await workspace
    .getByRole('navigation', { name: 'Side panel', exact: true })
    .getByRole('button', { name: 'Files', exact: true })
    .click();
  const path = repo.readme.path;
  await repo.write(path, 'Rewritten outside');
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = workspace.getByRole('textbox', { name: path, exact: true });
  await replaceEditorContent(editor, 'Saved in Porcelain');
  await userEvent.keyboard('{ControlOrMeta>}s{/ControlOrMeta}');
  await expect
    .element(workspace.getByText('Saved', { exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toBe('Saved in Porcelain');

  await repo.write(path, 'Rewritten outside');
  await expect.element(editor).toHaveTextContent('Rewritten outside');
  await expect
    .element(workspace.getByText('Saves as you pause', { exact: true }))
    .toBeVisible();

  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .element(workspace.getByText('Rewritten outside', { exact: true }))
    .toBeVisible();
  await workspace.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect.element(editor).toHaveTextContent('Rewritten outside');
  await replaceEditorContent(editor, 'Edited after the rewrite');
  await workspace.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toBe('Edited after the rewrite');
  await expect.element(workspace.getByRole('alert')).not.toBeInTheDocument();
});

test('reopening an editor starts from a rewrite that landed while its draft was unsaved', async ({
  workspace,
  repo,
  server,
}) => {
  await page.viewport(1440, 900);
  await workspace
    .getByRole('navigation', { name: 'Side panel', exact: true })
    .getByRole('button', { name: 'Files', exact: true })
    .click();
  const path = repo.readme.path;
  await repo.write(path, 'Saved text');
  await workspace
    .getByRole('treeitem', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Open file', exact: true })
    .click();
  await workspace
    .getByRole('tab', { name: path, exact: true })
    .click({ button: 'right' });
  await workspace.getByRole('menuitem', { name: /Open to the side/ }).click();
  const left = workspace.getByRole('region', {
    name: 'Left pane',
    exact: true,
  });
  const right = workspace.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  await expect
    .element(left.getByText('Saved text', { exact: true }))
    .toBeVisible();
  await left.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = left.getByRole('textbox', { name: path, exact: true });
  await editor.click();
  await userEvent.keyboard('{End}!');
  await expect.element(editor).toHaveTextContent('Saved text!');
  await repo.write(path, 'Rewritten outside');
  await expect
    .element(right.getByText('Rewritten outside', { exact: true }))
    .toBeVisible();
  await userEvent.keyboard('{Backspace}');
  await expect.element(editor).not.toHaveTextContent('Saved text!');
  await left.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .element(left.getByText('Rewritten outside', { exact: true }))
    .toBeVisible();

  await left.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect.element(editor).toHaveTextContent('Rewritten outside');
  await replaceEditorContent(editor, 'Edited after the rewrite');
  await left.getByRole('button', { name: 'Done', exact: true }).click();
  await expect
    .poll(async () => (await server.text(path)).text)
    .toBe('Edited after the rewrite');
  await expect.element(left.getByRole('alert')).not.toBeInTheDocument();
});

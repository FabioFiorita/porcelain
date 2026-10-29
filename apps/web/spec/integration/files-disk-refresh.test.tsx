import { page } from 'vitest/browser';
import { expect, test, replaceEditorContent } from './fixtures.tsx';

test.for(['clean', 'unsaved'] as const)(
  'a disk update refreshes split file tabs with a %s draft without React errors',
  async (initial, { workspace, repo, server }) => {
    await page.viewport(1440, 900);
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

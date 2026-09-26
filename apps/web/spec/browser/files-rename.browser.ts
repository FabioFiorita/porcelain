import { expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

const before = 'draft-notes.md';
const after = 'final-notes.md';

test('renaming a file in the tree moves it on disk and shows the new name', async ({
  app,
  repo,
  server,
}) => {
  await repo.write(before, 'Notes to rename\n');
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files' }).click();
  await opened
    .getByRole('treeitem', { name: before })
    .click({ button: 'right' });
  await opened.getByRole('menuitem', { name: 'Rename' }).click();
  const name = opened.getByRole('textbox', { name: /rename/i });
  await expect.element(name).toBeVisible();
  await name.fill(after);
  await userEvent.keyboard('{Enter}');
  await expect
    .element(opened.getByRole('treeitem', { name: after }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('treeitem', { name: before }))
    .not.toBeInTheDocument();
  await expect
    .element(opened.getByText('Change no longer present'))
    .not.toBeInTheDocument();
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .toContain(after);
  await expect
    .poll(async () =>
      (await server.directory('')).entries.map((entry) => entry.name),
    )
    .not.toContain(before);
});

test('renaming a file onto an existing name is refused and keeps both files', async ({
  repo,
  server,
}) => {
  await page.getByRole('treeitem', { name: after }).click({ button: 'right' });
  const renameAction = page.getByRole('menuitem', { name: 'Rename' });
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(renameAction).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  const name = page.getByRole('textbox', { name: /rename/i });
  await expect.element(name).toBeVisible();
  await name.fill(repo.readme.path);
  await userEvent.keyboard('{Enter}');
  await expect.element(page.getByText('Invalid name')).toBeVisible();
  await expect
    .element(page.getByRole('treeitem', { name: after }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.text(repo.readme.path)).text)
    .toBe(repo.readme.changed);
  await expect
    .poll(async () => (await server.text(after)).text)
    .toBe('Notes to rename\n');
});

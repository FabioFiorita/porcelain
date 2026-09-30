import { expect } from 'vitest';
import { page } from 'vitest/browser';
import { test } from '../kit/journey';

const kept = 'old-notes.md';
const gone = 'gone-notes.md';

const names = async (server: {
  directory: (path: string) => Promise<{ entries: { name: string }[] }>;
}) => (await server.directory('')).entries.map((entry) => entry.name);

test('moving a file to the trash from the tree removes it from disk and the tree', async ({
  app,
  repo,
  server,
}) => {
  await repo.write(kept, 'Notes to throw away\n');
  await repo.write(gone, 'Notes another writer removes\n');
  const opened = await app.open(await app.link('this'));
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Files', exact: true }).click();
  await opened
    .getByRole('treeitem', { name: kept, exact: true })
    .click({ button: 'right' });
  await opened
    .getByRole('menuitem', { name: 'Move to trash', exact: true })
    .click();
  const dialog = opened.getByRole('alertdialog');
  await expect
    .element(dialog.getByText(`Move ${kept} to the trash?`, { exact: true }))
    .toBeVisible();
  await dialog
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(opened.getByRole('treeitem', { name: kept, exact: true }))
    .not.toBeInTheDocument();
  await expect.poll(() => names(server)).not.toContain(kept);
});

test('moving a file another writer already removed to the trash is refused and says so', async ({
  repo,
  server,
}) => {
  await page
    .getByRole('treeitem', { name: gone, exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Move to trash', exact: true })
    .click();
  const dialog = page.getByRole('alertdialog');
  await expect
    .element(dialog.getByText(`Move ${gone} to the trash?`, { exact: true }))
    .toBeVisible();
  await repo.remove(gone);
  await expect.poll(() => names(server)).not.toContain(gone);
  await dialog
    .getByRole('button', { name: 'Move to trash', exact: true })
    .click();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('Path not found');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.poll(() => names(server)).toContain(repo.readme.path);
});

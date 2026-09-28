import { expect } from 'vitest';
import { test } from '../kit/journey';

test('open tabs, a pinned tab and a collapsed diff come back after a reload', async ({
  app,
  repo,
}) => {
  const readme = repo.readme.path;
  const notes = 'notes.md';
  await repo.write(notes, '# Notes\n');
  const opened = await app.openReloadable(await app.link('this'));
  const openFile = async (path: string) => {
    await opened.getByRole('button', { name: 'Review', exact: true }).click();
    await opened.getByRole('tab', { name: 'Files' }).click();
    const file = opened.getByRole('treeitem', { name: path });
    await expect.element(file).toBeVisible();
    await file.click({ button: 'right' });
    await opened.getByRole('menuitem', { name: 'Open file' }).click();
    await expect
      .element(opened.getByRole('tab', { name: new RegExp(path) }))
      .toBeVisible();
  };
  await openFile(readme);
  await openFile(notes);
  await opened
    .getByRole('tab', { name: new RegExp(readme) })
    .click({ button: 'right' });
  await opened.getByRole('menuitem', { name: 'Pin' }).click();
  await expect
    .element(opened.getByRole('button', { name: `Unpin ${readme}` }))
    .toBeVisible();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Changes' }).click();
  await opened.getByRole('button', { name: 'All changes' }).click();
  await opened.getByRole('button', { name: `Collapse ${readme}` }).click();
  await expect
    .element(opened.getByRole('button', { name: `Expand ${readme}` }))
    .toBeVisible();

  await app.reload();

  await expect
    .element(opened.getByRole('button', { name: `Expand ${readme}` }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('button', { name: `Unpin ${readme}` }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('tab', { name: new RegExp(notes) }))
    .toBeVisible();
  await expect
    .element(opened.getByRole('button', { name: `Close ${notes}` }))
    .toBeInTheDocument();
});

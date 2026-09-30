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
    await opened.getByRole('tab', { name: 'Files', exact: true }).click();
    const file = opened.getByRole('treeitem', { name: path, exact: true });
    await expect.element(file).toBeVisible();
    await file.click({ button: 'right' });
    await opened
      .getByRole('menuitem', { name: 'Open file', exact: true })
      .click();
    await expect
      .element(opened.getByRole('tab', { name: new RegExp(path) }))
      .toBeVisible();
  };
  await openFile(readme);
  await openFile(notes);
  await opened
    .getByRole('tab', { name: new RegExp(readme) })
    .click({ button: 'right' });
  await opened.getByRole('menuitem', { name: 'Pin', exact: true }).click();
  await expect
    .element(
      opened.getByRole('button', { name: `Unpin ${readme}`, exact: true }),
    )
    .toBeVisible();
  await opened.getByRole('button', { name: 'Review', exact: true }).click();
  await opened.getByRole('tab', { name: 'Changes', exact: true }).click();
  await opened
    .getByRole('button', { name: 'All changes', exact: true })
    .click();
  await opened
    .getByRole('button', { name: `Collapse ${readme}`, exact: true })
    .click();
  await expect
    .element(
      opened.getByRole('button', { name: `Expand ${readme}`, exact: true }),
    )
    .toBeVisible();

  await app.reload();

  await expect
    .element(
      opened.getByRole('button', { name: `Expand ${readme}`, exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      opened.getByRole('button', { name: `Unpin ${readme}`, exact: true }),
    )
    .toBeVisible();
  await expect
    .element(opened.getByRole('tab', { name: new RegExp(notes) }))
    .toBeVisible();
  await expect
    .element(
      opened.getByRole('button', { name: `Close ${notes}`, exact: true }),
    )
    .toBeInTheDocument();
});

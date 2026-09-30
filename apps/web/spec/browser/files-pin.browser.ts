import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { test } from '../kit/journey';

test('a pinned file is listed under Pinned, opens from there, and unpins', async ({
  pairedPage,
  repo,
  server,
}) => {
  const path = 'guide.md';
  await repo.write(path, '# Guide\n\nPinned reading\n');
  const pinned = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.pinned)
      .map((preference) => preference.path);

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = pairedPage.getByRole('treeitem', {
    name: 'guide.md',
    exact: true,
  });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await pairedPage
    .getByRole('menuitem', { name: 'Pin file', exact: true })
    .click();

  const group = pairedPage.getByRole('region', {
    name: 'Pinned files',
    exact: true,
  });
  await expect
    .element(group.getByText('guide.md', { exact: true }))
    .toBeVisible();
  await expect.poll(pinned).toEqual([path]);

  const commands = [
    'Rename',
    'Duplicate',
    'Show timeline',
    'Unpin file',
    'Hide file',
    'Copy relative path',
    'Copy full path',
    'Move to trash',
  ];
  await file.click({ button: 'right' });
  for (const name of commands)
    await expect
      .element(pairedPage.getByRole('menuitem', { name, exact: true }))
      .toBeVisible();
  await expect
    .element(
      pairedPage.getByRole('menuitem', { name: 'Pin file', exact: true }),
    )
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');

  await group
    .getByRole('button', { name: /guide\.md/ })
    .first()
    .click({ button: 'right' });
  for (const name of commands)
    await expect
      .element(pairedPage.getByRole('menuitem', { name, exact: true }))
      .toBeVisible();
  await expect
    .element(
      pairedPage.getByRole('menuitem', { name: 'Pin file', exact: true }),
    )
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');

  await pairedPage
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click();
  await expect
    .element(pairedPage.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await group
    .getByRole('button', { name: /guide\.md/ })
    .first()
    .click();
  await expect
    .element(pairedPage.getByText('Pinned reading', { exact: true }))
    .toBeVisible();

  await pairedPage.getByRole('button', { name: 'Review', exact: true }).click();
  await pairedPage.getByRole('tab', { name: 'Files', exact: true }).click();
  await pairedPage
    .getByRole('button', { name: `Unpin ${path}`, exact: true })
    .click();
  await expect.element(group).not.toBeInTheDocument();
  await expect.poll(pinned).toEqual([]);
});

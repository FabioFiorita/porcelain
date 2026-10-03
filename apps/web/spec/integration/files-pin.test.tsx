import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a pinned file is listed under Pinned, opens from there, and unpins', async ({
  workspace,
  repo,
  server,
}) => {
  const path = 'guide.md';
  await repo.write(path, '# Guide\n\nPinned reading\n');
  const pinned = async () =>
    (await server.filePreferences()).preferences
      .filter((preference) => preference.pinned)
      .map((preference) => preference.path);

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = workspace.getByRole('treeitem', {
    name: 'guide.md',
    exact: true,
  });
  await expect.element(file).toBeVisible();
  await file.click({ button: 'right' });
  await workspace
    .getByRole('menuitem', { name: 'Pin file', exact: true })
    .click();

  const group = workspace.getByRole('region', {
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
      .element(workspace.getByRole('menuitem', { name, exact: true }))
      .toBeVisible();
  await expect
    .element(workspace.getByRole('menuitem', { name: 'Pin file', exact: true }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');

  await group
    .getByRole('button', { name: /guide\.md/ })
    .first()
    .click({ button: 'right' });
  for (const name of commands)
    await expect
      .element(workspace.getByRole('menuitem', { name, exact: true }))
      .toBeVisible();
  await expect
    .element(workspace.getByRole('menuitem', { name: 'Pin file', exact: true }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');

  await workspace
    .getByRole('treeitem', { name: repo.readme.path, exact: true })
    .click();
  await expect
    .element(workspace.getByText('A change to review.', { exact: true }))
    .toBeVisible();
  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await group
    .getByRole('button', { name: /guide\.md/ })
    .first()
    .click();
  await expect
    .element(workspace.getByText('Pinned reading', { exact: true }))
    .toBeVisible();

  await workspace.getByRole('button', { name: 'Review', exact: true }).click();
  await workspace.getByRole('tab', { name: 'Files', exact: true }).click();
  await workspace
    .getByRole('button', { name: `Unpin ${path}`, exact: true })
    .click();
  await expect.element(group).not.toBeInTheDocument();
  await expect.poll(pinned).toEqual([]);
});

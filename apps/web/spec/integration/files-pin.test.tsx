import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('a saved file pin opens directly when its parent listing fails', async ({
  render,
  repo,
  fetchGate,
  agent,
}) => {
  const failListing = fetchGate.failDirectoryReads('wide');
  await agent.editFile({
    kind: 'create',
    path: 'wide',
    entryKind: 'directory',
  });
  await repo.write('wide/target.txt', 'Direct pinned file reading');
  const app = await render.workspace();
  await app.getByRole('button', { name: 'Review', exact: true }).click();
  await app.getByRole('tab', { name: 'Files', exact: true }).click();
  await app.getByRole('treeitem', { name: 'wide', exact: true }).click();
  await app
    .getByRole('treeitem', { name: 'target.txt', exact: true })
    .click({ button: 'right' });
  await app.getByRole('menuitem', { name: 'Pin file', exact: true }).click();
  const pins = app.getByRole('region', { name: 'Pinned files', exact: true });
  await expect
    .element(pins.getByRole('button', { name: 'wide/target.txt', exact: true }))
    .toBeEnabled();
  failListing();
  await repo.write('wide/another.txt', 'Refresh the directory');
  const open = pins.getByRole('button', {
    name: 'Open wide/target.txt as file',
    exact: true,
  });
  await expect.element(open).toBeEnabled();
  await open.click();
  await expect
    .element(app.getByText('Direct pinned file reading', { exact: true }))
    .toBeVisible();
});

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

test('a pinned folder loads children only when expanded and opens its child document', async ({
  repo,
  render,
  agent,
  fetchGate,
  server,
}) => {
  await agent.editFile({
    kind: 'create',
    path: 'manual',
    entryKind: 'directory',
  });
  await repo.write('manual/intro.md', '# Pinned folder reading\n');
  await repo.write('manual/other.md', '# Other reading\n');
  const reads = fetchGate.recordDirectoryReads();
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await page
    .getByRole('treeitem', { name: 'manual', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Pin folder', exact: true }).click();
  const group = page.getByRole('region', { name: 'Pinned files', exact: true });
  const folder = group.getByRole('button', { name: 'manual', exact: true });
  await expect.element(folder).toHaveAttribute('aria-expanded', 'false');
  await expect
    .poll(async () =>
      (await server.filePreferences()).preferences
        .filter((entry) => entry.pinned)
        .map((entry) => entry.path),
    )
    .toEqual(['manual']);
  await expect.poll(() => reads).not.toContain('manual');
  await folder.click();
  await group.getByRole('treeitem', { name: 'intro.md', exact: true }).click();
  await expect
    .element(
      page.getByRole('heading', { name: 'Pinned folder reading', exact: true }),
    )
    .toBeVisible();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  await expect.element(folder).toHaveAttribute('aria-expanded', 'true');
  await expect
    .element(group.getByRole('treeitem', { name: 'other.md', exact: true }))
    .toBeVisible();
  await folder.click();
  await expect
    .element(group.getByRole('treeitem', { name: 'other.md', exact: true }))
    .not.toBeInTheDocument();
  await group
    .getByRole('button', { name: 'Unpin manual', exact: true })
    .click();
  await expect.element(group).not.toBeInTheDocument();
});

test('a hidden pinned file leaves Pinned and returns with the hidden toggle', async ({
  repo,
  render,
}) => {
  await repo.write('hidden-pin.md', '# Hidden pin\n');
  const page = await render.workspace();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('tab', { name: 'Files', exact: true }).click();
  const file = page.getByRole('treeitem', {
    name: 'hidden-pin.md',
    exact: true,
  });
  await file.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Pin file', exact: true }).click();
  const group = page.getByRole('region', { name: 'Pinned files', exact: true });
  await expect
    .element(group.getByRole('button', { name: 'hidden-pin.md', exact: true }))
    .toBeVisible();
  await file.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Hide file', exact: true }).click();
  await expect.element(group).not.toBeInTheDocument();
  await page
    .getByRole('region', { name: 'All files', exact: true })
    .getByRole('button', { name: 'Show', exact: true })
    .click();
  await expect
    .element(group.getByRole('button', { name: 'hidden-pin.md', exact: true }))
    .toBeVisible();
});

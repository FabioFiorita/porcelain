import { expect, test } from './fixtures.ts';

test('Files searches unloaded untracked paths without losing input and restores expansion', async ({
  app,
  repo,
  agent,
}, info) => {
  const name = 'AVeryLongComponentFileNameThatShouldTruncateNicely.tsx';
  const path = `apps/web/src/components/deeply/nested/folder/structure/for/testing/long/paths/${name}`;
  const segments = path.split('/').slice(0, -1);
  for (let index = 1; index <= segments.length; index++)
    await agent.editFile({
      kind: 'create',
      path: segments.slice(0, index).join('/'),
      entryKind: 'directory',
    });
  await agent.editFile({
    kind: 'create',
    path: 'notes',
    entryKind: 'directory',
  });
  await repo.write(path, 'export const value = 1;\n');
  await repo.write('notes/first.txt', 'First\n');
  await repo.write('notes/second.txt', 'Second\n');
  const page = await app.open(await app.link('this'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const tree = page.getByRole('region', { name: 'All files', exact: true });
  const row = (name: string) =>
    tree.getByRole('treeitem', { name, exact: true });
  await row('notes').click();
  await expect(row('first.txt')).toBeVisible();
  await expect(row(name)).toHaveCount(0);
  const search = page.getByRole('textbox', {
    name: 'Search files',
    exact: true,
  });
  await search.click();
  await search.pressSequentially('Nicely');
  await expect(search).toHaveValue('Nicely');
  await expect(search).toBeFocused();
  await expect(row(name)).toBeVisible();
  await expect(row('README.md')).toHaveCount(0);
  await expect(row('notes')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('nested-search.png') });
  await search.fill('AVeryLong');
  await expect(row(name)).toBeVisible();
  await search.fill('no-such-file');
  await expect(tree.getByRole('treeitem')).toHaveCount(0);
  await search.fill('');
  await expect(row('README.md')).toBeVisible();
  await expect(search).toBeFocused();
  await expect(row('first.txt')).toBeVisible();
  await expect(row('apps')).toHaveAttribute('aria-expanded', 'false');
  await search.fill('Nicely');
  await expect(row(name)).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear search and collapse all', exact: true })
    .click();
  await expect(search).toHaveValue('');
  await expect(row('notes')).toHaveAttribute('aria-expanded', 'false');
  await expect(row('first.txt')).toHaveCount(0);
  await search.fill('Nicely');
  await expect(row(name)).toBeVisible();
  await row(name).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const rename = page.getByRole('textbox', { name: /^Rename / });
  await expect(rename).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(row('README.md')).toBeVisible();
  await rename.fill('Renamed.tsx');
  await rename.press('Enter');
  await expect(row('Renamed.tsx')).toBeVisible();
  await expect
    .poll(() =>
      repo
        .read(path.replace(name, 'Renamed.tsx'))
        .catch((error: unknown) => String(error)),
    )
    .toBe('export const value = 1;\n');
  await search.fill('Renamed');
  await row('Renamed.tsx').focus();
  await page.keyboard.press('F2');
  await expect(rename).toBeFocused();
  await expect(search).toHaveValue('');
  await rename.press('Escape');
  await expect(row('Renamed.tsx')).toBeVisible();
});

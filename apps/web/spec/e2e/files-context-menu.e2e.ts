import { expect, test } from './fixtures.ts';

test('consecutive right-clicks position the menu at the second row for every file and folder pairing', async ({
  app,
  repo,
  agent,
}) => {
  for (const path of ['alpha', 'beta'])
    await agent.editFile({ kind: 'create', path, entryKind: 'directory' });
  await repo.write('guide.md', 'Guide\n');
  const page = await app.open(await app.link('this'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const row = (name: string) =>
    page.getByRole('treeitem', { name, exact: true, includeHidden: true });
  for (const [first, second] of [
    ['alpha', 'beta'],
    ['guide.md', 'README.md'],
    ['alpha', 'guide.md'],
    ['guide.md', 'beta'],
    ['beta', 'beta'],
  ] as const) {
    await row(first).click({ button: 'right', position: { x: 150, y: 12 } });
    await expect(page.getByRole('menu')).toBeVisible();
    const target = await row(second).boundingBox();
    if (!target) throw new Error('The second row must be visible');
    await page.mouse.click(target.x + 31, target.y + 12, { button: 'right' });
    await expect
      .poll(async () => {
        const popup = await page.getByRole('menu').boundingBox();
        return (
          popup &&
          Math.abs(popup.y - (target.y + 16)) <= 1 &&
          Math.abs(popup.x - (target.x + 31)) <= 1
        );
      })
      .toBe(true);
    await expect(row(second)).toHaveAttribute('data-context-menu-open', '');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(row(second)).toBeFocused();
  }
  await row('guide.md').focus();
  await page.keyboard.press('Shift+F10');
  await expect(
    page.getByRole('menu', { name: 'guide.md actions', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: 'Rename', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: /^Rename / })).toBeFocused();
  await page.keyboard.press('Escape');
  await row('guide.md').click({ button: 'right', position: { x: 31, y: 12 } });
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row('guide.md')).toBeFocused();
});

test('a menu at the bottom right keeps every label on one line and every action inside the viewport', async ({
  app,
  repo,
}, info) => {
  for (let index = 0; index < 22; index++)
    await repo.write(
      `qa-${String(index).padStart(2, '0')}.md`,
      'Menu fixture\n',
    );
  const page = await app.open(await app.link('this'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const bottomRow = page.getByRole('treeitem', {
    name: 'qa-21.md',
    exact: true,
  });
  await expect(bottomRow).toBeVisible();
  const target = await bottomRow.boundingBox();
  if (!target) throw new Error('The bottom row must be visible');
  await expect
    .poll(async () => (await bottomRow.boundingBox())?.y ?? 0)
    .toBeGreaterThan(600);
  await page.mouse.click(target.x + target.width - 10, target.y + 12, {
    button: 'right',
  });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await menu.boundingBox();
      if (
        !bounds ||
        bounds.x < 0 ||
        bounds.y < 0 ||
        bounds.x + bounds.width > 1280 ||
        bounds.y + bounds.height > 800
      )
        return false;
      for (const item of await menu.getByRole('menuitem').all()) {
        const rect = await item.boundingBox();
        if (
          !rect ||
          rect.height > 33 ||
          rect.y < bounds.y ||
          rect.y + rect.height > bounds.y + bounds.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
  await expect(
    menu.getByRole('menuitem', { name: 'Copy full path', exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole('menuitem', { name: 'Move to trash', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('menu-bottom-right.png') });
});

test('one outside pointer press dismisses the menu and clears accessible and visible row ownership', async ({
  app,
  repo,
}) => {
  await repo.write('guide.md', 'Guide\n');
  const page = await app.open(await app.link('this'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const owner = page.getByRole('treeitem', {
    name: 'guide.md',
    exact: true,
    includeHidden: true,
  });
  await owner.click({ button: 'right', position: { x: 100, y: 12 } });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(owner).toHaveAttribute('data-context-menu-open', '');
  await expect(owner).toHaveAttribute('aria-haspopup', 'menu');
  const outside = await page
    .getByRole('treeitem', {
      name: 'README.md',
      exact: true,
      includeHidden: true,
    })
    .boundingBox();
  if (!outside) throw new Error('The outside row must be visible');
  await page.mouse.click(outside.x + 5, outside.y + 12);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(owner).not.toHaveAttribute('data-context-menu-open');
  await expect(owner).not.toHaveAttribute('aria-haspopup');
});

import { expect, test } from './fixtures.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`project management is separate from filtering at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      server,
    }) => {
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      const project = await server.project();
      const computer = (await server.inventory()).environment.name;
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      const manage = page.getByRole('button', {
        name: 'Manage projects',
        exact: true,
      });
      await expect(manage).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Open project', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Filter reviews', exact: true })
        .click();
      await expect(
        page.getByRole('menuitem', { name: 'Projects', exact: true }),
      ).not.toBeAttached();
      await page
        .getByRole('menuitemcheckbox', {
          name: `${project.name} · ${computer}`,
          exact: true,
        })
        .click();
      await page.keyboard.press('Escape');
      await manage.focus();
      await manage.press('Enter');
      const item = page.getByRole('menuitem', {
        name: project.name,
        exact: true,
      });
      await expect(item).toBeVisible();
      await item.focus();
      await item.press('ArrowRight');
      await expect(
        page.getByRole('menuitem', { name: 'Copy path', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('menuitem', { name: 'Rename project', exact: true })
        .click();
      const rename = page.getByRole('dialog', {
        name: 'Rename project',
        exact: true,
      });
      const name = `Project ${'a'.repeat(92)}`;
      await rename
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill(name);
      await rename.getByRole('button', { name: 'Rename', exact: true }).click();
      await expect(rename).not.toBeAttached();
      await expect.poll(async () => (await server.project()).name).toBe(name);
      await manage.click();
      await page.getByRole('menuitem', { name, exact: true }).click();
      await page
        .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
        .click();
      const remove = page.getByRole('alertdialog', {
        name: `Remove ${name} from Porcelain?`,
        exact: true,
      });
      await expect(remove).toBeVisible();
      await expect
        .poll(() =>
          remove.evaluate((node) => node.scrollWidth <= node.clientWidth),
        )
        .toBe(true);
      await remove.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(remove).not.toBeAttached();
      await expect.poll(async () => (await server.project()).name).toBe(name);
      await manage.click();
      const menu = page.getByRole('menu', {
        name: 'Manage projects',
        exact: true,
      });
      await expect(menu).toBeVisible();
      await menu.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(manage).toBeFocused();
      await page
        .getByRole('button', { name: 'Filter reviews', exact: true })
        .click();
      await expect(
        page.getByRole('menuitemcheckbox', {
          name: `${name} · ${computer}`,
          exact: true,
        }),
      ).toHaveAttribute('aria-checked', 'false');
    });
  }
}

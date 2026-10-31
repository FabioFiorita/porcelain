import { menuPaint } from '../kit/navigator.ts';
import { expect, test } from './fixtures.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`project header actions survive filtering and support pointer and keyboard at ${width}px in ${colorScheme}`, async ({
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
      const header = (name: string) =>
        page
          .getByRole('navigation', {
            name: 'Projects and worktrees',
            exact: true,
          })
          .getByText(name, { exact: true });
      const actions = (name: string) =>
        page.getByRole('button', {
          name: `Project actions: ${name} · ${computer}`,
          exact: true,
        });
      await expect(actions(project.name)).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Manage projects', exact: true }),
      ).not.toBeAttached();
      await expect(
        page.getByRole('button', { name: 'Open project', exact: true }),
      ).toBeVisible();
      const filter = page.getByRole('button', {
        name: 'Filter worktrees',
        exact: true,
      });
      await filter.click();
      if (width === 1440) {
        const option = page.getByRole('menuitemcheckbox', {
          name: 'Without a review',
          exact: true,
        });
        const before = await menuPaint(option);
        await option.hover();
        await expect
          .poll(async () => (await menuPaint(option)).background)
          .not.toBe(before.background);
        await expect
          .poll(async () => (await menuPaint(option)).cursor)
          .toBe('pointer');
      }
      await page
        .getByRole('menuitemcheckbox', {
          name: `${project.name} · ${computer}`,
          exact: true,
        })
        .click();
      await page.keyboard.press('Escape');
      await expect(header(project.name)).not.toBeAttached();
      await filter.click();
      await page
        .getByRole('menuitem', { name: 'Clear filters', exact: true })
        .click();
      await expect(header(project.name)).toBeVisible();
      await actions(project.name).click();
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
      await expect(header(name)).toBeVisible();
      await actions(name).click();
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
      await actions(name).focus();
      await actions(name).press('Enter');
      const menu = page.getByRole('menu').filter({
        has: page.getByRole('menuitem', { name: 'Copy path', exact: true }),
      });
      await expect(menu).toBeVisible();
      await menu.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(actions(name)).toBeFocused();
      await filter.click();
      await expect(
        page.getByRole('menuitemcheckbox', {
          name: `${name} · ${computer}`,
          exact: true,
        }),
      ).toHaveAttribute('aria-checked', 'true');
    });
  }
}

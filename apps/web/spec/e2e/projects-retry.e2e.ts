import { expect, test } from './fixtures.ts';
import { projectFixture } from '../kit/project-fixture.ts';

const faults = [
  [
    'replacement',
    "Porcelain doesn't recognise this repository as the one it registered. Remove the project and add it again.",
  ],
  ['missing', 'The repository folder is missing.'],
  ['denied', 'Porcelain cannot read this repository because access is denied.'],
  ['corrupt', 'Git could not read this repository.'],
] as const;

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`unavailable project actions fit and Retry recovers at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      server,
      app,
    }) => {
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      const project = await server.project();
      const main = project.worktrees.find((worktree) => worktree.main)?.path;
      if (!main) throw new Error('Missing main checkout');
      const fixture = await projectFixture(main);
      await app.open('/?worktree=unselected');
      await expect(
        page.getByText('Worktree not found', { exact: true }),
      ).toBeVisible();
      const live = app.holdLive();
      const manage = page.getByRole('button', {
        name: 'Manage projects',
        exact: true,
      });
      const openActions = async () => {
        await manage.click();
        await page
          .getByRole('menuitem', { name: project.name, exact: true })
          .click();
      };
      try {
        for (const [fault, message] of faults) {
          await page.waitForLoadState('networkidle');
          await fixture.unavailable(fault);
          await app.reload();
          const toggle = page.getByRole('button', {
            name: 'Toggle Sidebar',
            exact: true,
          });
          await expect(toggle).toBeVisible();
          if (!(await manage.isVisible())) await toggle.click();
          await openActions();
          await expect(page.getByText(message, { exact: true })).toBeVisible();
          const retry = page.getByRole('menuitem', {
            name: 'Retry',
            exact: true,
          });
          const actions = page.getByRole('menu').filter({ has: retry });
          await expect
            .poll(() =>
              actions.evaluate((node, viewportWidth) => {
                const bounds = node.getBoundingClientRect();
                return bounds.left >= 0 && bounds.right <= viewportWidth;
              }, width),
            )
            .toBe(true);
          await expect(
            page.getByRole('menuitem', {
              name: 'Remove from Porcelain',
              exact: true,
            }),
          ).toBeVisible();
          await fixture.restore();
          const before = await fixture.refreshes();
          await retry.click();
          await expect.poll(() => fixture.refreshes()).toBe(before + 1);
          await expect(page.getByRole('menu')).toHaveCount(0);
          await openActions();
          await expect(retry).not.toBeAttached();
          await expect(
            page.getByText(message, { exact: true }),
          ).not.toBeAttached();
          await expect(
            page.getByRole('menuitem', { name: 'Rename project', exact: true }),
          ).toBeVisible();
          await expect
            .poll(async () => (await server.project()).available)
            .toBe(true);
        }
      } finally {
        await fixture.restore();
        live.release();
      }
    });
  }
}

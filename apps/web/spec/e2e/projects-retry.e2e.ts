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
    for (const [fault, message] of faults) {
      test(`unavailable ${fault} project actions fit and reloading recovers at ${width}px in ${colorScheme}`, async ({
        page,
        server,
        app,
      }) => {
        await page.setViewportSize({ width, height: 896 });
        await page.emulateMedia({ colorScheme });
        const project = await server.project();
        const computer = (await server.inventory()).environment.name;
        const main = project.worktrees.find((worktree) => worktree.main)?.path;
        if (!main) throw new Error('Missing main checkout');
        const fixture = await projectFixture(main);
        await app.open(`/${project.id}/unselected-worktree`);
        await expect(
          page.getByRole('heading', {
            name: 'This browser is not paired',
            exact: true,
          }),
        ).toBeVisible();
        await app.open(await app.link('this'));
        await expect(
          page.getByText('Worktree not found', { exact: true }),
        ).toBeVisible();
        const actionsButton = page.getByRole('button', {
          name: `Project actions: ${project.name} · ${computer}`,
          exact: true,
        });
        try {
          await page.waitForLoadState('networkidle');
          await fixture.unavailable(fault);
          await app.reload();
          const toggle = page.getByRole('button', {
            name: 'Toggle Sidebar',
            exact: true,
          });
          await expect(toggle).toBeVisible();
          if ((await toggle.getAttribute('aria-expanded')) === 'false')
            await toggle.click();
          await actionsButton.click();
          await expect(page.getByText(message, { exact: true })).toBeVisible();
          const actions = page.getByRole('menu').filter({
            has: page.getByRole('menuitem', {
              name: 'Remove from Porcelain',
              exact: true,
            }),
          });
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
          await page.keyboard.press('Escape');
          await app.reload();
          if ((await toggle.getAttribute('aria-expanded')) === 'false')
            await toggle.click();
          await actionsButton.click();
          await expect(
            page.getByText(message, { exact: true }),
          ).not.toBeAttached();
          await expect(
            page.getByRole('menuitem', { name: 'Rename project', exact: true }),
          ).toBeVisible();
          await expect
            .poll(async () => (await server.project()).available)
            .toBe(true);
        } finally {
          await fixture.restore();
        }
      });
    }
  }
}

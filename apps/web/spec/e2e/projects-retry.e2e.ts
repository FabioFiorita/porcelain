import { expect, test } from './fixtures.ts';

const reasons = [
  [
    'moved',
    "Porcelain doesn't recognise this repository as the one it registered. Remove the project and add it again.",
  ],
  ['missing', 'The repository folder is missing.'],
  [
    'permission',
    'Porcelain cannot read this repository because access is denied.',
  ],
  ['git-failed', 'Git could not read this repository.'],
  [undefined, "Porcelain can't reach this repository right now."],
] as const;

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`unavailable project actions fit and Retry recovers at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      server,
    }) => {
      await page.setViewportSize({ width, height: 896 });
      await page.emulateMedia({ colorScheme });
      const project = await server.project();
      let unavailable = false;
      let reason: (typeof reasons)[number][0];
      await page.route('**/api/inventory', async (route) => {
        const response = await route.fetch();
        const inventory = await response.json();
        if (unavailable)
          inventory.projects = [
            {
              ...project,
              available: false,
              ...(reason ? { unavailableReason: reason } : {}),
              worktrees: project.worktrees.map((worktree) => ({
                ...worktree,
                available: false,
              })),
            },
          ];
        await route.fulfill({ response, json: inventory });
      });
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
        for (const [value, message] of reasons) {
          reason = value;
          unavailable = true;
          await page.reload();
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
              actions.evaluate((node) => {
                const bounds = node.getBoundingClientRect();
                return bounds.left >= 0 && bounds.right <= innerWidth;
              }),
            )
            .toBe(true);
          await expect(
            page.getByRole('menuitem', {
              name: 'Remove from Porcelain',
              exact: true,
            }),
          ).toBeVisible();
          unavailable = false;
          let refreshed = false;
          page.on('response', (response) => {
            if (
              new URL(response.url()).pathname === '/api/inventory/refresh' &&
              response.request().method() === 'POST' &&
              response.status() === 200
            )
              refreshed = true;
          });
          await retry.click();
          await expect.poll(() => refreshed).toBe(true);
          await expect(page.getByRole('menu')).toHaveCount(0);
          await openActions();
          await expect(retry).not.toBeAttached();
          await expect(
            page.getByText(message, { exact: true }),
          ).not.toBeAttached();
          await expect(
            page.getByRole('menuitem', { name: 'Rename project', exact: true }),
          ).toBeVisible();
        }
      } finally {
        await page.unrouteAll({ behavior: 'wait' });
      }
    });
  }
}

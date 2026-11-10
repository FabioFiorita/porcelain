import { statusReadWorktreeIds } from '../kit/worktree-status.ts';
import { expect, test } from './fixtures.ts';

for (const width of [1440, 414]) {
  test(`worktree status failures stay quiet after dismissal and recover through the row menu at ${width}px`, async ({
    pairedPage: page,
    repo,
    server,
    app,
    live,
    world,
  }) => {
    await page.setViewportSize({ width, height: 896 });
    await page.emulateMedia({ colorScheme: width === 414 ? 'dark' : 'light' });
    await repo.worktree('status-first');
    await repo.worktree('status-second');
    const project = await server.project();
    const computer = (await server.inventory()).environment.name;
    const mainId = project.worktrees.find((worktree) => worktree.main)!.id;
    const restore = await live.failWorktreeStatusRead(mainId);
    try {
      await app.reload();
      const toggle = page.getByRole('button', {
        name: 'Toggle Sidebar',
        exact: true,
      });
      await expect(toggle).toBeVisible();
      if ((await toggle.getAttribute('aria-expanded')) === 'false')
        await toggle.click();
      const toast = page.getByRole('dialog', {
        name: `Couldn’t check changes on ${computer}`,
        exact: true,
      });
      await expect(toast).toHaveCount(1);
      await toast.hover();
      await expect(toast).toContainText('2 worktrees');
      await toast.getByRole('button', { name: 'Details', exact: true }).click();
      await expect(
        toast.getByText('status-first', { exact: true }),
      ).toBeVisible();
      await expect(
        toast.getByText('status-second', { exact: true }),
      ).toBeVisible();
      await expect(
        toast.getByText('Request failed (503)', { exact: true }),
      ).toHaveCount(2);
      await toast
        .getByRole('button', { name: 'Close toast', exact: true })
        .click();
      await expect(toast).not.toBeAttached();
      if (width === 414) await page.keyboard.press('Escape');
      else await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toast).not.toBeAttached();
      const sidebar = page.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      });
      const search = sidebar.getByRole('searchbox', {
        name: 'Search worktrees',
        exact: true,
      });
      await search.fill('status-');
      await expect(
        sidebar.getByRole('button', { name: /Changes unavailable/ }),
      ).toHaveCount(2);
      await expect(toast).not.toBeAttached();
      await expect(
        sidebar.getByText('Changes unavailable', { exact: true }),
      ).not.toBeAttached();
      await expect(
        sidebar.getByRole('img', {
          name: 'Local uncommitted changes: Changes unavailable',
          exact: true,
        }),
      ).toHaveCount(2);
      const path = app.address().path;
      const currentProject = await server.project();
      const expectedWorktrees = currentProject.worktrees
        .filter((worktree) => !worktree.main)
        .map((worktree) => worktree.id)
        .sort();
      await expect.poll(() => expectedWorktrees.length).toBe(2);
      const before = (await world.hits('this')).length;
      await restore();
      const first = sidebar.getByRole('button', {
        name: /^status-first,.*Changes unavailable/,
      });
      await first.click({ button: 'right' });
      await page
        .getByRole('menuitem', { name: 'Retry changes', exact: true })
        .click();
      await expect(
        sidebar.getByRole('button', {
          name: /status-first,.*Working tree clean/,
        }),
      ).toBeVisible();
      await expect(
        sidebar.getByRole('button', {
          name: /status-second,.*Working tree clean/,
        }),
      ).toBeVisible();
      await expect.poll(() => app.address().path).toBe(path);
      await expect
        .poll(async () =>
          statusReadWorktreeIds((await world.hits('this')).slice(before)),
        )
        .toEqual(expectedWorktrees);
      await expect(toast).not.toBeAttached();
    } finally {
      await restore();
    }
  });
}

test('a toast retries failed status after its project is collapsed without changing selection', async ({
  pairedPage: page,
  repo,
  server,
  app,
  live,
}) => {
  await page.setViewportSize({ width: 1440, height: 896 });
  await repo.worktree('hidden-status');
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  const main = project.worktrees.find((worktree) => worktree.main)!;
  const restore = await live.failWorktreeStatusRead(main.id);
  try {
    await app.reload();
    const toast = page.getByRole('dialog', {
      name: `Couldn’t check changes on ${computer}`,
      exact: true,
    });
    await expect(toast).toBeVisible();
    await toast.hover();
    await page
      .getByRole('button', {
        name: `Collapse ${project.name} · ${computer}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('button', { name: /^hidden-status,/ }),
    ).not.toBeAttached();
    const path = app.address().path;
    await restore();
    await toast.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(toast).not.toBeAttached();
    await expect.poll(() => app.address().path).toBe(path);
    await page
      .getByRole('button', {
        name: `Expand ${project.name} · ${computer}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('button', { name: /hidden-status,.*Working tree clean/ }),
    ).toBeVisible();
    await expect(toast).not.toBeAttached();
  } finally {
    await restore();
  }
});

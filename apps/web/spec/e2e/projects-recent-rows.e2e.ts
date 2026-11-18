import { expect, test } from './fixtures.ts';

test('an expanded project shows main and its five latest worktrees, keeps the selected one and shows the rest on request', async ({
  pairedPage: page,
  repo,
  server,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 896 });
  const names = Array.from({ length: 7 }, (_, index) => `recent-${index + 1}`);
  for (const name of names) await repo.worktree(name);
  await app.reload();
  const project = await server.project();
  const mainBranch =
    project.worktrees.find((worktree) => worktree.main)?.branch ?? '';
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const cards = sidebar.locator('[data-navigator-card]');
  const titles = (expected: readonly string[]) =>
    expected.map((name) => expect.stringMatching(`^${name}(\\d+ files?)?$`));
  const shown = () =>
    cards.evaluateAll((items) =>
      items.map((item) => item.textContent?.trim() ?? ''),
    );
  await expect.poll(shown).toEqual(titles([mainBranch, ...names.slice(0, 5)]));
  await sidebar
    .getByRole('button', { name: 'Show 2 more', exact: true })
    .click();
  await expect.poll(shown).toEqual(titles([mainBranch, ...names]));
  const older = sidebar.getByRole('button', { name: /^recent-7,/ });
  await older.click();
  await expect(older).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('button', { name: 'Show less', exact: true }).click();
  await expect
    .poll(shown)
    .toEqual(titles([mainBranch, ...names.slice(0, 5), 'recent-7']));
  await expect(
    sidebar.getByRole('button', { name: 'Show 1 more', exact: true }),
  ).toBeVisible();
  await sidebar
    .getByRole('searchbox', { name: 'Search worktrees', exact: true })
    .fill('recent-6');
  await expect.poll(shown).toEqual(titles(['recent-6']));
});

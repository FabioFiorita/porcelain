import { expect, test } from './fixtures.ts';

test('an expanded project shows main and its five most recently touched worktrees, keeps the selected one and promotes live uncommitted work', async ({
  pairedPage: page,
  repo,
  server,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 896 });
  const names = Array.from({ length: 7 }, (_, index) => `recent-${index + 1}`);
  for (const name of names) await repo.worktree(name);
  await repo.worktree('zz-dated');
  await repo.commitAfterMain('zz-dated', 'A later commit');
  await app.reload();
  const project = await server.project();
  const mainBranch =
    project.worktrees.find((worktree) => worktree.main)?.branch ?? '';
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const rows = sidebar.getByRole('button', {
    name: new RegExp(`^[^,]+, (?:[^,]+, )?${project.name}, `),
  });
  const expectOrder = async (expected: readonly string[]) => {
    await expect(rows).toHaveCount(expected.length);
    for (const [index, branch] of expected.entries())
      await expect(rows.nth(index)).toHaveAccessibleName(
        new RegExp(`^${branch}, `),
      );
  };
  await expectOrder([mainBranch, 'zz-dated', ...names.slice(0, 4)]);
  await sidebar
    .getByRole('button', { name: 'Show 3 more', exact: true })
    .click();
  await expectOrder([mainBranch, 'zz-dated', ...names]);
  const older = sidebar.getByRole('button', { name: /^recent-5, / });
  await older.click();
  await expect(older).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('button', { name: 'Show less', exact: true }).click();
  await expectOrder([mainBranch, 'zz-dated', ...names.slice(0, 4), 'recent-5']);
  await expect(
    sidebar.getByRole('button', { name: 'Show 2 more', exact: true }),
  ).toBeVisible();
  await older.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('tooltip', { name: /^recent-5 · \// }),
  ).toBeVisible();
  await repo.writeInWorktree('recent-7', 'agent-notes.md', 'In progress\n');
  await expectOrder([
    mainBranch,
    'recent-7',
    'zz-dated',
    ...names.slice(0, 3),
    'recent-5',
  ]);
  await sidebar
    .getByRole('searchbox', { name: 'Search worktrees', exact: true })
    .fill('recent-6');
  await expectOrder(['recent-6']);
});

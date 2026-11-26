import { expect, test } from './fixtures.ts';

test('a failed background status read keeps the row’s last count and shows no notice', async ({
  pairedPage: page,
  repo,
  server,
  app,
  live,
}) => {
  await page.setViewportSize({ width: 1440, height: 896 });
  await repo.worktree('quiet-status');
  await repo.write('quiet-one.md', 'One\n');
  await app.reload();
  await expect
    .poll(async () => (await server.project()).worktrees.length)
    .toBe(2);
  const project = await server.project();
  const main = project.worktrees.find((worktree) => worktree.main)!;
  const other = project.worktrees.find((worktree) => !worktree.main)!;
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const mainCard = sidebar.getByRole('listitem').filter({
    has: page.getByRole('button', { name: /Main worktree/ }),
  });
  const count = mainCard.getByText(/^\d+ uncommitted$/);
  await expect(count).toHaveText('2 uncommitted');
  const restore = await live.failWorktreeStatusRead(other.id);
  try {
    const failed = live.worktreeStatusFailed(main.id);
    await repo.write('quiet-two.md', 'Two\n');
    await failed;
    await expect(count).toHaveText('2 uncommitted');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(sidebar.getByRole('status')).toHaveCount(0);
    await expect(
      sidebar.getByRole('button', { name: 'Read again', exact: true }),
    ).toHaveCount(0);
  } finally {
    await restore();
  }
  await repo.write('quiet-three.md', 'Three\n');
  await expect(count).toHaveText('4 uncommitted');
});

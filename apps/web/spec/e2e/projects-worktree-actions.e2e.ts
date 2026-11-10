import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';

test('worktree actions protect main and switch an unselected checkout without moving the selected workspace', async ({
  pairedPage: page,
  repo,
  server,
  app,
}) => {
  await repo.branch('available-branch');
  await repo.worktree('switch-topic');
  await app.reload();
  await page.setViewportSize({ width: 1440, height: 896 });
  const project = await server.project();
  const target = project.worktrees.find(
    (entry) => entry.branch === 'switch-topic',
  );
  if (!target) throw new Error('Missing switch-topic worktree');
  const original = app.address().path;
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  await sidebar
    .getByRole('button', { name: /Main worktree/ })
    .click({ button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Copy worktree path', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: 'Switch branch', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: 'Delete', exact: true }),
  ).not.toBeAttached();
  await page.keyboard.press('Escape');
  await sidebar
    .getByRole('button', { name: /^switch-topic,/ })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Switch branch', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Switch branch',
    exact: true,
  });
  await expect(
    dialog.getByRole('option', { name: 'switch-topic Current', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('option', {
      name: new RegExp(`^${repo.initialBranch} In use$`),
    }),
  ).toBeDisabled();
  const search = dialog.getByRole('combobox', {
    name: 'Find a branch',
    exact: true,
  });
  await search.fill('NO-MATCH');
  await expect(
    dialog.getByText('No matching branch', { exact: true }),
  ).toBeVisible();
  await search.fill('available-branch');
  await dialog
    .getByRole('option', { name: 'available-branch', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Switch branch', exact: true })
    .click();
  await expect(dialog).not.toBeAttached();
  await expect
    .poll(
      async () =>
        (await server.project()).worktrees.find(
          (entry) => entry.id === target.id,
        )?.branch,
    )
    .toBe('available-branch');
  await expect.poll(() => app.address().path).toBe(original);
  await expect(
    sidebar.getByRole('button', { name: /Main worktree.*Current$/ }),
  ).toHaveCount(1);
});

test('a checkout without a review can keep its files while deleting its branch, then delete the detached folder', async ({
  pairedPage: page,
  repo,
  server,
  app,
}) => {
  const main = (await server.project()).worktrees.find(
    (entry) => entry.main,
  )?.path;
  if (!main) throw new Error('Missing main checkout');
  await archiveFixture(main);
  await repo.worktree('kept-no-review');
  await app.reload();
  await page.setViewportSize({ width: 1440, height: 896 });
  const project = await server.project();
  const target = project.worktrees.find(
    (entry) => entry.branch === 'kept-no-review',
  );
  if (!target) throw new Error('Missing kept-no-review worktree');
  const before = await server.reviewGitSettings();
  const original = app.address().path;
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const row = sidebar.getByRole('button', {
    name: /^kept-no-review,/,
  });
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('alertdialog', {
    name: 'Delete kept-no-review?',
    exact: true,
  });
  await dialog
    .getByRole('switch', { name: 'Delete local worktree', exact: true })
    .click();
  await dialog
    .getByRole('switch', { name: 'Delete remote branch', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: 'Review deletion', exact: true })
    .click();
  await expect(dialog).toContainText('Keep worktree detached from its branch:');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeAttached();
  await expect
    .poll(async () =>
      (await server.project()).worktrees.find(
        (entry) => entry.id === target.id,
      ),
    )
    .toMatchObject({ available: true, branch: undefined });
  await expect(row).toHaveAccessibleName(/Detached HEAD/);
  await expect.poll(() => app.address().path).toBe(original);
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Review deletion', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeAttached();
  await expect
    .poll(async () =>
      (await server.project()).worktrees.some(
        (entry) => entry.id === target.id,
      ),
    )
    .toBe(false);
  await expect.poll(() => server.reviewGitSettings()).toEqual(before);
  await expect.poll(() => app.address().path).toBe(original);
});

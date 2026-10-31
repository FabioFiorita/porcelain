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

test('Delete choices reset from saved settings on each opening and detached checkouts disable branch deletion', async ({
  pairedPage: page,
  repo,
  server,
  app,
}) => {
  const main = (await server.project()).worktrees.find(
    (entry) => entry.main,
  )?.path;
  if (!main) throw new Error('Missing main checkout');
  const fixture = await archiveFixture(main);
  const before = await server.reviewGitSettings();
  await expect
    .poll(() => server.reviewGitSettings())
    .toMatchObject({
      kind: 'configured',
      settings: {
        archiveDeleteWorktree: true,
        archiveDeleteLocalBranch: true,
        archiveDeleteRemoteBranch: true,
      },
    });
  await repo.worktree('detached-menu');
  await repo.detachWorktree('detached-menu');
  await app.reload();
  await page.setViewportSize({ width: 1440, height: 896 });
  const sidebar = page.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const openDelete = async (name: RegExp) => {
    await sidebar
      .getByRole('button', { name, exact: true })
      .click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  };
  await openDelete(/^archive-fixture,/);
  const dialog = page.getByRole('alertdialog', {
    name: 'Delete archive-fixture?',
    exact: true,
  });
  for (const label of [
    'Delete local worktree',
    'Delete local branch',
    'Delete remote branch',
  ])
    await expect(
      dialog.getByRole('switch', { name: label, exact: true }),
    ).toBeChecked();
  await dialog
    .getByRole('switch', { name: 'Delete local worktree', exact: true })
    .click();
  await expect(
    dialog.getByText(
      'Keep the worktree folder and its files, detach it from the branch, then delete the local branch.',
      { exact: true },
    ),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => server.reviewGitSettings()).toEqual(before);
  await expect.poll(() => fixture.exists()).toBe(true);
  await openDelete(/^archive-fixture,/);
  await expect(
    dialog.getByRole('switch', { name: 'Delete local worktree', exact: true }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await openDelete(/^detached-menu,/);
  const detached = page.getByRole('alertdialog', {
    name: 'Delete detached-menu?',
    exact: true,
  });
  for (const label of ['Delete local branch', 'Delete remote branch']) {
    await expect(
      detached.getByRole('switch', { name: label, exact: true }),
    ).not.toBeChecked();
    await expect(
      detached.getByRole('switch', { name: label, exact: true }),
    ).toBeDisabled();
  }
  await detached.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => server.reviewGitSettings()).toEqual(before);
  await expect.poll(() => fixture.exists()).toBe(true);
  await openDelete(/^archive-fixture,/);
  await dialog
    .getByRole('button', { name: 'Review deletion', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeAttached();
  await expect.poll(() => fixture.exists()).toBe(false);
  await expect
    .poll(async () => (await fixture.readReview())?.state)
    .toBe('open');
  await expect
    .poll(async () => (await fixture.readReview())?.archived ?? false)
    .toBe(false);
  await expect.poll(() => server.reviewGitSettings()).toEqual(before);
  await sidebar
    .getByRole('button', { name: 'Filter worktrees', exact: true })
    .click();
  await page
    .getByRole('menuitemcheckbox', { name: 'Show older reviews', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await sidebar
    .getByRole('link', { name: /^archive-fixture,.*Retained review/ })
    .click();
  await expect
    .poll(() => app.address().path)
    .toBe(`/reviews/${fixture.reviewId}`);
  await expect(
    page.getByRole('region', { name: 'You asked', exact: true }),
  ).toContainText('Verify the disposable README review');
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
    name: /^kept-no-review,.*No review/,
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

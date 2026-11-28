import { expect, test } from './fixtures.ts';

test('opening a repository with one checkout gives it a direct project row in the navigator', async ({
  projectHome,
  pairedPage,
  server,
  app,
}) => {
  const registered = async () =>
    (await server.inventory()).projects.flatMap((project) =>
      project.worktrees.map((worktree) => worktree.path),
    );
  const browsed = await projectHome.repository('browsed');
  await projectHome.folder('plain');
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Open project', exact: true })
    .click();
  const dialog = pairedPage.getByRole('dialog', {
    name: 'Open project',
    exact: true,
  });
  await dialog.getByRole('button', { name: 'plain', exact: true }).click();
  await expect(
    dialog.getByText('No subfolders.', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Up', exact: true }).click();
  await dialog.getByRole('button', { name: 'browsed', exact: true }).click();
  await expect(
    dialog.getByText('Every worktree appears in the sidebar.', {
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Open repository', exact: true })
    .click();

  await expect(dialog).not.toBeAttached();
  await expect(
    pairedPage.getByRole('dialog', { name: 'Sidebar', exact: true }),
  ).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();

  await expect.poll(registered).toContain(browsed);
  const inventory = await server.inventory();
  const project = inventory.projects.find((item) => item.name === 'browsed');
  const checkout = project?.worktrees.find((item) => item.path === browsed);
  if (!project || !checkout) throw new Error('Missing browsed checkout');
  const sidebar = pairedPage.getByRole('navigation', {
    name: 'Projects and worktrees',
    exact: true,
  });
  const row = sidebar.getByRole('button', {
    name: /, browsed,.*Main worktree/,
  });
  await expect(row.getByText('browsed', { exact: true })).toBeVisible();
  await expect(row).toHaveAttribute('aria-current', 'page');
  await expect(
    sidebar.getByRole('button', { name: /^(Collapse|Expand) browsed ·/ }),
  ).not.toBeAttached();
  const actions = sidebar.getByRole('button', {
    name: /^Project actions: browsed ·/,
  });
  await actions.click();
  await expect(
    pairedPage.getByRole('menuitem', { name: 'Rename project', exact: true }),
  ).toBeVisible();
  await pairedPage.keyboard.press('Escape');
  await expect(actions).toBeFocused();
  const other = sidebar.getByRole('button', { name: /Main worktree/ }).filter({
    hasNotText: 'browsed',
  });
  await other.click();
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  const search = sidebar.getByRole('searchbox', {
    name: 'Search worktrees',
    exact: true,
  });
  await search.fill('browsed');
  await search.press('ArrowUp');
  await expect(row).toBeFocused();
  await row.press('Enter');
  await expect
    .poll(() => app.address().path)
    .toBe(`/${project.id}/${checkout.id}`);
});

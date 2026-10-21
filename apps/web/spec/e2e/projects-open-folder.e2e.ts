import { expect, test } from './fixtures.ts';

test('browsing to a Git repository opens it as a project in the navigator and the server registers it', async ({
  projectHome,
  pairedPage,
  server,
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
    .getByRole('button', { name: 'Open browsed', exact: true })
    .click();

  await expect(dialog).not.toBeAttached();
  await pairedPage
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await pairedPage
    .getByRole('menuitem', { name: 'Worktrees', exact: true })
    .click();
  await expect(
    pairedPage.getByRole('menuitemradio', {
      name: /\bbrowsed\b/,
      checked: true,
    }),
  ).toBeVisible();
  await expect.poll(registered).toContain(browsed);
});

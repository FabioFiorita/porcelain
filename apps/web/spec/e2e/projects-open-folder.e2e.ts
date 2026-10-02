import { expect, test } from './fixtures.ts';

test('a folder that is not a Git repository cannot be opened by browsing', async ({
  projectHome,
  pairedPage,
  server,
}) => {
  const registered = async () =>
    (await server.inventory()).projects.flatMap((project) =>
      project.worktrees.map((worktree) => worktree.path),
    );
  const plain = await projectHome.folder('plain');
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
  await expect(
    dialog.getByText('Pick a folder that is a Git repository.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Open plain', exact: true }),
  ).toBeDisabled();
  await expect.poll(registered).not.toContain(plain);
});

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
  await expect(
    pairedPage.getByRole('button', { name: 'browsed', exact: true }),
  ).toBeVisible();
  await expect.poll(registered).toContain(browsed);
});

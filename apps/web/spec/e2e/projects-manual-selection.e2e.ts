import { expect, test } from './fixtures.ts';

test('only the repository selected by browsing is registered', async ({
  projectHome,
  pairedPage,
  server,
}) => {
  const selected = await projectHome.repository('selected');
  await projectHome.repository('unselected');
  const registered = async () =>
    (await server.inventory()).projects.flatMap((project) =>
      project.worktrees.map((worktree) => worktree.path),
    );
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
  await expect(
    dialog.getByRole('button', { name: 'unselected', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'selected', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('region', {
      name: 'Found on this machine',
      exact: true,
    }),
  ).not.toBeAttached();
  await expect.poll(registered).toHaveLength(1);
  await dialog.getByRole('button', { name: 'selected', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Open selected', exact: true })
    .click();
  await expect(dialog).not.toBeAttached();
  await expect(
    pairedPage.getByRole('button', { name: 'selected', exact: true }),
  ).toBeVisible();
  await expect.poll(registered).toContain(selected);
  await expect.poll(registered).toHaveLength(2);
});

import { expect } from 'vitest';
import { test } from '../kit/journey';
import { projectHome } from '../kit/project-home';

test('only the repository selected by browsing is registered', async ({
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
  await expect
    .element(dialog.getByRole('button', { name: 'unselected', exact: true }))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('button', { name: 'selected', exact: true }))
    .toBeVisible();
  await expect
    .element(
      dialog.getByRole('region', {
        name: 'Found on this machine',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect.poll(registered).toHaveLength(1);
  await dialog.getByRole('button', { name: 'selected', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Open selected', exact: true })
    .click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByRole('button', { name: 'selected', exact: true }))
    .toBeVisible();
  await expect.poll(registered).toContain(selected);
  await expect.poll(registered).toHaveLength(2);
});

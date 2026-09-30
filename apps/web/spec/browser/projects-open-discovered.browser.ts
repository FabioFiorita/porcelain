import { expect } from 'vitest';
import { test } from '../kit/journey';
import { projectHome } from '../kit/project-home';

test('a repository found on this machine opens as a project in the navigator and the server registers it', async ({
  pairedPage,
  server,
}) => {
  const path = await projectHome.repository('discovered');
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
  const found = dialog.getByRole('region', {
    name: 'Found on this machine',
    exact: true,
  });
  await found
    .getByRole('textbox', {
      name: 'Search repositories on this machine',
      exact: true,
    })
    .fill('discovered');
  const repository = found.getByRole('button', {
    name: `discovered ${path}`,
    exact: true,
  });
  await expect.element(repository).toBeVisible();
  await repository.click();

  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(
      pairedPage.getByRole('button', { name: 'discovered', exact: true }),
    )
    .toBeVisible();
  await expect
    .poll(async () =>
      (await server.inventory()).projects.flatMap((project) =>
        project.worktrees.map((worktree) => worktree.path),
      ),
    )
    .toContain(path);
});

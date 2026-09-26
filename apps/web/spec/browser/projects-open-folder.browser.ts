import { expect } from 'vitest';
import { test } from '../kit/journey';
import { projectHome } from '../kit/project-home';

test('a folder that is not a Git repository cannot be opened by browsing or by typing its path', async ({
  pairedPage,
  server,
}) => {
  const registered = async () =>
    (await server.inventory()).projects.flatMap((project) =>
      project.worktrees.map((worktree) => worktree.path),
    );
  const plain = await projectHome.folder('plain');
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Open project' }).click();
  const dialog = pairedPage.getByRole('dialog', { name: 'Open project' });
  await dialog.getByRole('button', { name: 'plain', exact: true }).click();
  await expect.element(dialog.getByText('No subfolders.')).toBeVisible();
  await expect
    .element(dialog.getByText('Pick a folder that is a Git repository.'))
    .toBeVisible();
  await expect
    .element(dialog.getByRole('button', { name: 'Open plain' }))
    .toBeDisabled();

  await dialog.getByRole('button', { name: 'Enter a path' }).click();
  await dialog
    .getByRole('textbox', { name: 'Repository path' })
    .fill('relative/repository');
  await expect
    .element(dialog.getByRole('button', { name: 'Open project' }))
    .toBeDisabled();
  await expect.element(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Repository path' }).fill(plain);
  await dialog.getByRole('button', { name: 'Open project' }).click();
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('Repository could not be inspected');
  await expect.poll(registered).not.toContain(plain);
});

test('browsing to a Git repository opens it as a project in the navigator and the server registers it', async ({
  pairedPage,
  server,
}) => {
  const registered = async () =>
    (await server.inventory()).projects.flatMap((project) =>
      project.worktrees.map((worktree) => worktree.path),
    );
  const browsed = await projectHome.repository('browsed');
  const dialog = pairedPage.getByRole('dialog', { name: 'Open project' });
  await dialog.getByRole('button', { name: 'Up' }).click();
  await dialog.getByRole('button', { name: 'browsed', exact: true }).click();
  await expect
    .element(dialog.getByText('Every worktree appears in the sidebar.'))
    .toBeVisible();
  await dialog.getByRole('button', { name: 'Open browsed' }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(pairedPage.getByRole('button', { name: 'browsed', exact: true }))
    .toBeVisible();
  await expect.poll(registered).toContain(browsed);
});

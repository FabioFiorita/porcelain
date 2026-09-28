import { expect } from 'vitest';
import { test } from '../kit/journey';

test('opening a repository with a linked worktree from the empty workspace after a reload shows the worktree it opened, leaving no empty workspace to go back to', async ({
  app,
  repo,
  server,
}) => {
  const opened = await app.openReloadable(await app.link('this'));
  const sample = await server.project();
  const main = sample.worktrees.find((worktree) => worktree.main) ?? {
    id: '',
    path: '',
  };

  await opened.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await opened
    .getByRole('button', { name: sample.name, exact: true })
    .click({ button: 'right' });
  await opened.getByRole('menuitem', { name: 'Remove from Porcelain' }).click();
  await opened
    .getByRole('alertdialog', { name: `Remove ${sample.name} from Porcelain?` })
    .getByRole('button', { name: 'Remove from Porcelain' })
    .click();
  await expect
    .element(opened.getByText('No projects registered'))
    .toBeVisible();
  await expect.poll(() => app.address().path).toBe('/');
  await app.reload();
  await expect
    .element(opened.getByText('Select a worktree', { exact: true }))
    .toBeVisible();

  await repo.worktree('linked');
  await opened.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await opened.getByRole('button', { name: 'Open project' }).click();
  const dialog = opened.getByRole('dialog', { name: 'Open project' });
  await dialog.getByRole('button', { name: 'Enter a path' }).click();
  await dialog
    .getByRole('textbox', { name: 'Repository path' })
    .fill(main.path);
  await dialog.getByRole('button', { name: 'Open project' }).click();
  await expect.element(dialog).not.toBeInTheDocument();

  const reopened = async () =>
    (await server.inventory()).projects.find((project) =>
      project.worktrees.some((worktree) => worktree.path === main.path),
    );
  await expect.poll(async () => (await reopened())?.worktrees.length).toBe(2);
  const project = await reopened();
  const shown = `/${project?.id ?? ''}/${project?.worktrees.find((worktree) => worktree.main)?.id ?? ''}`;
  await expect.poll(() => app.address().path).toBe(shown);
  await expect
    .element(
      opened.getByRole('button', { name: /Main worktree/, pressed: true }),
    )
    .toBeVisible();
  await expect.poll(() => app.visited()).toEqual([shown]);
});

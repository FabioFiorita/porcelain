import { expect, test } from './fixtures.ts';

test('opening a repository with a linked worktree from the empty workspace after a reload shows the worktree it opened, leaving no empty workspace to go back to', async ({
  app,
  repo,
  server,
}) => {
  const opened = await app.open(await app.link('this'));
  const sample = await server.project();
  const main = sample.worktrees.find((worktree) => worktree.main) ?? {
    id: '',
    path: '',
  };

  await opened
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await opened
    .getByRole('button', { name: sample.name, exact: true })
    .click({ button: 'right' });
  await opened
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  await opened
    .getByRole('alertdialog', {
      name: `Remove ${sample.name} from Porcelain?`,
      exact: true,
    })
    .getByRole('button', { name: 'Remove from Porcelain', exact: true })
    .click();
  await expect(
    opened.getByText('No projects registered', { exact: true }),
  ).toBeVisible();
  await expect.poll(() => app.address().path).toBe('/');
  await app.reload();
  await expect(
    opened.getByText('Select a worktree', { exact: true }),
  ).toBeVisible();

  await repo.worktree('linked');
  await opened
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await opened
    .getByRole('button', { name: 'Open project', exact: true })
    .click();
  const dialog = opened.getByRole('dialog', {
    name: 'Open project',
    exact: true,
  });
  await expect(
    dialog.getByRole('navigation', { name: 'Folder path', exact: true }),
  ).toBeVisible();
  for (const name of main.path.split('/').filter(Boolean))
    await dialog.getByRole('button', { name, exact: true }).click();
  await dialog
    .getByRole('button', {
      name: `Open ${main.path.split('/').filter(Boolean).at(-1) ?? 'folder'}`,
      exact: true,
    })
    .click();
  await expect(dialog).not.toBeAttached();

  const reopened = async () =>
    (await server.inventory()).projects.find((project) =>
      project.worktrees.some((worktree) => worktree.path === main.path),
    );
  await expect.poll(async () => (await reopened())?.worktrees.length).toBe(2);
  const project = await reopened();
  const shown = `/${project?.id ?? ''}/${project?.worktrees.find((worktree) => worktree.main)?.id ?? ''}`;
  await expect.poll(() => app.address().path).toBe(shown);
  await expect(
    opened.getByRole('button', { name: /Main worktree/, pressed: true }),
  ).toBeVisible();
  await expect.poll(() => app.visited()).toEqual([shown]);
});

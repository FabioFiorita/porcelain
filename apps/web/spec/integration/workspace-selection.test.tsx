import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('an unselected workspace offers the first worktree needing attention ahead of the main checkout', async ({
  repo,
  server,
  render,
}) => {
  const review = await repo.review('A decision needing attention');
  await expect
    .poll(async () => {
      const project = await server.project();
      return project.worktrees.find((entry) => entry.path === review.worktree)
        ?.status;
    })
    .toBe('pending');
  const project = await server.project();
  const target = project.worktrees.find(
    (entry) => entry.path === review.worktree,
  );
  if (!target) throw new Error('The published worktree was not registered.');
  const page = await render.selection();
  await expect
    .element(
      page.getByRole('heading', { name: 'Select a worktree', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(page.getByText('First that needs you', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole('link', { name: 'durable-review', exact: true }))
    .toHaveAttribute('href', `/${project.id}/${target.id}`);
});

test('first run offers project registration without inactive search advice', async ({
  render,
  server,
}) => {
  const project = await server.project();
  const app = await render.route('/');
  await app.page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await app.page
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await app.page
    .getByRole('menuitem', { name: 'Projects', exact: true })
    .click();
  await app.page
    .getByRole('menuitem', { name: project.name, exact: true })
    .click();
  await app.page
    .getByRole('menuitem', { name: 'Remove from Porcelain', exact: true })
    .click();
  await app.page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Remove from Porcelain', exact: true })
    .click();
  await expect
    .element(app.page.getByText('No projects registered', { exact: true }))
    .toBeVisible();
  await expect
    .element(
      app.page.getByText('Try another search or clear the filters.', {
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await app.navigate('/');
  await expect
    .element(
      app.page.getByRole('heading', {
        name: 'Open your first project',
        exact: true,
      }),
    )
    .toBeVisible();
  await app.page
    .getByTestId('document')
    .getByRole('button', { name: 'Open project', exact: true })
    .click();
  await expect
    .element(
      app.page.getByRole('dialog', { name: 'Open project', exact: true }),
    )
    .toBeVisible();
});

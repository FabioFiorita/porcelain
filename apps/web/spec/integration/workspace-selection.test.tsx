import { userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('first run offers project registration without inactive search advice', async ({
  render,
  server,
}) => {
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  const app = await render.route('/');
  await app.page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await app.page
    .getByRole('button', {
      name: `Project actions: ${project.name} · ${computer}`,
      exact: true,
    })
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
  await expect
    .element(app.page.getByRole('dialog', { name: 'Sidebar', exact: true }))
    .not.toBeInTheDocument();
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
    .getByRole('button', { name: 'Open project', exact: true })
    .filter({ hasText: 'Open project' })
    .click();
  await expect
    .element(
      app.page.getByRole('dialog', { name: 'Open project', exact: true }),
    )
    .toBeVisible();
});

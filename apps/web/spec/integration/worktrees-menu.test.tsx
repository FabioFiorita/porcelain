import { expect, test } from './fixtures.tsx';

test('worktrees without reviews remain reachable in the flat checkout menu', async ({
  navigator,
  server,
}) => {
  const project = await server.project();
  const computer = (await server.inventory()).environment.name;
  const main = navigator.getByRole('button', {
    name: new RegExp(project.name),
  });
  await expect.element(main.getByText(computer, { exact: true })).toBeVisible();
  await navigator
    .getByRole('button', { name: 'Filter reviews', exact: true })
    .click();
  await navigator
    .getByRole('menuitem', { name: 'Worktrees', exact: true })
    .click();
  await expect
    .element(
      navigator.getByRole('menuitem', { name: new RegExp(project.name) }),
    )
    .toBeVisible();
  await expect
    .element(
      navigator
        .getByRole('menuitem', { name: new RegExp(project.name) })
        .getByText(computer, { exact: true }),
    )
    .toBeVisible();
  await navigator
    .getByRole('searchbox', { name: 'Search worktrees', exact: true })
    .fill('NO-MATCH');
  await expect
    .element(
      navigator.getByRole('menuitem', { name: new RegExp(project.name) }),
    )
    .not.toBeInTheDocument();
});

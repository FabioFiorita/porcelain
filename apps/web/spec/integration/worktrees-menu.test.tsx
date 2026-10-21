import { expect, test } from './fixtures.tsx';

test('worktrees without reviews remain reachable in the flat checkout menu', async ({
  navigator,
  server,
}) => {
  const project = await server.project();
  await navigator
    .getByRole('button', { name: 'Worktrees', exact: true })
    .click();
  await expect
    .element(
      navigator.getByRole('menuitem', { name: new RegExp(project.name) }),
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

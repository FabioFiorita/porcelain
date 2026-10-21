import { expect, test } from './fixtures.tsx';

test('worktrees without reviews remain reachable in the flat checkout menu', async ({
  navigator,
  server,
}) => {
  const closed = navigator.getByRole('button', {
    name: 'Closed reviews',
    exact: true,
  });
  await expect.element(closed).toHaveTextContent('');
  await closed.click();
  await expect
    .element(navigator.getByText('No closed reviews', { exact: true }))
    .toBeVisible();
  await navigator
    .getByRole('button', { name: 'Back to reviews', exact: true })
    .click();
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

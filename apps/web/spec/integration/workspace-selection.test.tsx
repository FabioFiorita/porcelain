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

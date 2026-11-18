import { expect, test } from './fixtures.tsx';

test.for(['arrive', 'return'] as const)(
  'a cold saved tab stays readable and honors the latest request: %s',
  async (destination, { repo, render, server, reviewLayout, fetchGate }) => {
    await repo.write('first.txt', 'First document\n');
    await repo.write('second.txt', 'Second document\n');
    const project = await server.project();
    const worktree = project.worktrees.find((entry) => entry.main);
    if (!worktree) throw new Error('The fixture has no main worktree');
    reviewLayout.saveTabs(worktree.id, ['file:first.txt', 'file:second.txt']);
    const held = fetchGate.holdNextTextRead('second.txt');
    held.arm();
    const route = await render.route(
      `/${project.id}/${worktree.id}?entry=file:first.txt`,
    );
    const screen = route.page;
    const code = screen.getByRole('region', {
      name: 'Code content',
      exact: true,
    });
    await expect.element(code).toBeVisible();
    const height = reviewLayout.visibleHeight(code);
    await expect
      .element(screen.getByRole('tab', { name: 'second.txt', exact: true }))
      .toBeVisible();
    const selecting = Promise.resolve(
      screen.getByRole('tab', { name: 'second.txt', exact: true }).click(),
    );
    try {
      await held.requested;
      await expect.poll(height).toBeGreaterThan(0);
      await expect
        .element(screen.getByRole('tab', { name: 'first.txt', exact: true }))
        .toHaveAttribute('aria-selected', 'true');
      if (destination === 'return')
        await screen
          .getByRole('tab', { name: 'first.txt', exact: true })
          .click();
      held.release();
      await selecting;
      await held.finished;
      const path = destination === 'return' ? 'first.txt' : 'second.txt';
      await expect
        .element(screen.getByRole('heading', { name: path, exact: true }))
        .toBeVisible();
      await expect
        .element(screen.getByRole('tab', { name: path, exact: true }))
        .toHaveAttribute('aria-selected', 'true');
    } finally {
      held.release();
      await selecting;
    }
  },
);

test('the old All changes link lands on Review over a saved file tab', async ({
  render,
  server,
  reviewLayout,
}) => {
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree');
  reviewLayout.saveTabs(worktree.id, ['file:README.md']);
  const route = await render.route(
    `/${project.id}/${worktree.id}?entry=walkthrough-changes`,
  );
  await expect
    .element(route.page.getByRole('tab', { name: 'Review', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(route.page.getByRole('tab', { name: 'README.md', exact: true }))
    .toHaveAttribute('aria-selected', 'false');
  await expect
    .poll(() =>
      new URL(route.location(), 'http://test').searchParams.get('entry'),
    )
    .toBe('review');
});

test('an old Walkthrough entry for the right pane never opens a second Review', async ({
  repo,
  render,
  server,
  reviewLayout,
}) => {
  await repo.write('notes.txt', 'Notes beside the review\n');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree');
  reviewLayout.saveTabs(
    worktree.id,
    ['file:README.md'],
    ['walkthrough', 'file:notes.txt'],
  );
  const route = await render.route(`/${project.id}/${worktree.id}`);
  const right = route.page.getByRole('region', {
    name: 'Right pane',
    exact: true,
  });
  await expect
    .element(right.getByRole('tab', { name: 'notes.txt', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(right.getByRole('tab', { name: 'Review', exact: true }))
    .not.toBeInTheDocument();
  await route.navigate(
    `/${project.id}/${worktree.id}?entry=review&side=walkthrough`,
  );
  await expect
    .poll(() =>
      new URL(route.location(), 'http://test').searchParams.get('side'),
    )
    .toBeNull();
  await expect.element(right).not.toBeInTheDocument();
  await expect
    .element(route.page.getByRole('tab', { name: 'Review', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

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

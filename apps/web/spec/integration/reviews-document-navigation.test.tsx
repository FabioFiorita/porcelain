import { userEvent } from 'vite-plus/test/browser';
import { expect, test } from './fixtures.tsx';

test.for(['arrive', 'return'] as const)(
  'a cold saved file tab becomes active and honors the latest request: %s',
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
    await expect
      .element(screen.getByRole('tab', { name: 'second.txt', exact: true }))
      .toBeVisible();
    const selecting = Promise.resolve(
      screen.getByRole('tab', { name: 'second.txt', exact: true }).click(),
    );
    try {
      await held.requested;
      await expect
        .element(screen.getByRole('tab', { name: 'second.txt', exact: true }))
        .toHaveAttribute('aria-selected', 'true');
      await expect
        .element(
          screen
            .getByRole('tabpanel', { name: 'second.txt', exact: true })
            .getByRole('status', { name: 'Loading file', exact: true }),
        )
        .toBeInTheDocument();
      await expect.element(code).not.toBeInTheDocument();
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

test('opening a file from the tree selects it before its text arrives', async ({
  repo,
  render,
  server,
  fetchGate,
}) => {
  await repo.write('notes.txt', 'Ready to read\n');
  await repo.commit('Add notes');
  const project = await server.project();
  const main = project.worktrees.find((worktree) => worktree.main);
  if (!main) throw new Error('The fixture has no main worktree');
  const held = fetchGate.holdNextTextRead('notes.txt');
  held.arm();
  const app = await render.route(`/${project.id}/${main.id}?entry=review`);
  const target = app.page.getByRole('tab', { name: 'notes.txt', exact: true });
  const emptyReview = app.page.getByText('No changes to review.', {
    exact: true,
  });
  await expect.element(emptyReview).toBeVisible();
  try {
    await app.page
      .getByRole('button', { name: 'Side panel', exact: true })
      .click();
    await app.page.getByRole('tab', { name: 'Files', exact: true }).click();
    await app.page
      .getByRole('treeitem', { name: 'notes.txt', exact: true })
      .click();
    await held.requested;
    await expect.element(target).toHaveAttribute('aria-selected', 'true');
    await expect.element(emptyReview).not.toBeVisible();
  } finally {
    held.release();
  }
  await expect
    .element(app.page.getByText('Ready to read', { exact: true }))
    .toBeVisible();
});

test('source is readable while review marks are unavailable', async ({
  repo,
  render,
  server,
  fetchGate,
}) => {
  await repo.write('notes.txt', 'Source without review marks\n');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree');
  const held = fetchGate.holdNextReviewedRead();
  held.arm();
  try {
    const app = await render.route(
      `/${project.id}/${worktree.id}?entry=file:notes.txt`,
    );
    await expect
      .element(
        app.page.getByText('Source without review marks', { exact: true }),
      )
      .toBeVisible();
  } finally {
    held.release();
  }
});

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

test('an old Walkthrough entry for the right pane keeps that pane on its own document', async ({
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
    .toBe('file:notes.txt');
  await expect
    .element(right.getByRole('tab', { name: 'notes.txt', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .element(right.getByRole('tab', { name: 'Review', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(route.page.getByRole('tab', { name: 'Review', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
});

test('each document panel is labelled by its own tab as the keyboard switches tabs', async ({
  repo,
  render,
  server,
  reviewLayout,
}) => {
  await repo.write('notes.md', 'Notes\n');
  const project = await server.project();
  const worktree = project.worktrees.find((entry) => entry.main);
  if (!worktree) throw new Error('The fixture has no main worktree');
  reviewLayout.saveTabs(worktree.id, ['file:README.md', 'file:notes.md']);
  const route = await render.route(
    `/${project.id}/${worktree.id}?entry=file:README.md`,
  );
  const screen = route.page;
  for (const [name, keys] of [
    ['Review', '{Alt>}{ArrowLeft}{/Alt}'],
    ['notes.md', '{Alt>}{ArrowLeft}{/Alt}'],
    ['README.md', '{Alt>}{ArrowLeft}{/Alt}'],
  ] as const) {
    await userEvent.keyboard(keys);
    const tab = screen.getByRole('tab', { name, exact: true });
    await expect.element(tab).toHaveAttribute('aria-selected', 'true');
    await expect.element(tab).toHaveAttribute('aria-controls');
    await expect
      .element(screen.getByRole('tabpanel', { name, exact: true }))
      .toBeVisible();
  }
});

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

test('published review documents carry their revision and split through URLs and browser Back', async ({
  agent,
  render,
  server,
}) => {
  await agent.publishArchitecture();
  const publication = (await server.publishedReview()).review;
  if (!publication) throw new Error('The fixture has no published review');
  const route = await render.route(`/reviews/${publication.reviewId}/1`);
  const screen = route.page;
  await screen
    .getByRole('button', { name: /^2\. Revoke access across devices ·/ })
    .click();
  await expect.poll(() => route.location()).toContain('/decisions/');
  const decisionLocation = route.location();
  await screen
    .getByRole('button', {
      name: /^Go to step 1: Revoke from the device list ·/,
    })
    .click();
  const path = 'apps/web/src/revoke-access.ts';
  const key = `review-file:${publication.reviewId}:1:${path}`;
  await expect
    .element(screen.getByRole('tab', { name: path, exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() =>
      new URL(route.location(), 'http://fixture').searchParams.get('entry'),
    )
    .toBe(key);
  await expect
    .poll(() => route.location())
    .toContain(`/reviews/${publication.reviewId}/1`);
  const fileLocation = route.location();
  await screen
    .getByRole('tab', { name: path, exact: true })
    .click({ button: 'right' });
  await screen.getByRole('menuitem', { name: /Open to the side/ }).click();
  const right = screen.getByRole('region', { name: 'Right pane', exact: true });
  await expect.element(right).toBeVisible();
  await expect
    .poll(() =>
      new URL(route.location(), 'http://fixture').searchParams.get('side'),
    )
    .toBe(key);
  await route.back();
  await expect.element(right).not.toBeInTheDocument();
  await expect.poll(() => route.location()).toBe(fileLocation);
  await route.back();
  await expect
    .element(screen.getByRole('tab', { name: 'Review', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => route.location()).toBe(decisionLocation);
  await expect
    .element(
      screen.getByRole('region', {
        name: '2. Revoke access across devices',
        exact: true,
      }),
    )
    .toBeVisible();
});

import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('the right panel defaults open and shares an explicit choice across workspace and Settings remounts', async ({
  repo,
  server,
  render,
}) => {
  await page.viewport(1280, 896);
  try {
    const review = await repo.review('Another workspace');
    const project = await server.project();
    const other = project.worktrees.find(
      (worktree) => worktree.path === review.worktree,
    );
    if (!other) throw new Error('Missing fixture worktree');
    const main = project.worktrees.find((worktree) => worktree.main);
    if (!main) throw new Error('Missing main worktree');
    const app = await render.route(`/${project.id}/${main.id}`);
    const panel = app.page.getByRole('complementary', {
      name: 'Review sidebar',
      exact: true,
    });
    await expect.element(panel).toBeVisible();
    await app.page
      .getByRole('button', { name: 'Hide side panel', exact: true })
      .click();
    await expect.element(panel).not.toBeInTheDocument();
    await app.navigate(`/${project.id}/${other.id}`);
    await expect
      .element(
        app.page.getByRole('button', { name: 'Show side panel', exact: true }),
      )
      .toBeVisible();
    await app.navigate(`/reviews/${review.reviewId}/${review.revision}`);
    await expect
      .element(
        app.page.getByRole('button', { name: 'Show side panel', exact: true }),
      )
      .toBeVisible();
    await app.navigate('/settings/general');
    await userEvent.keyboard('{Escape}');
    await expect
      .element(
        app.page.getByRole('button', { name: 'Show side panel', exact: true }),
      )
      .toBeVisible();
    await app.page
      .getByRole('button', { name: 'Show side panel', exact: true })
      .click();
    await app.navigate(`/reviews/${review.reviewId}/${review.revision}`);
    await expect.element(panel).toBeVisible();
    await app.navigate(`/${project.id}/${main.id}`);
    await expect.element(panel).toBeVisible();
    await page.viewport(414, 896);
    await expect.element(panel).not.toBeInTheDocument();
    await app.page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect
      .element(
        app.page.getByRole('dialog', { name: 'Worktree review', exact: true }),
      )
      .toBeVisible();
    await userEvent.keyboard('{Escape}');
    await page.viewport(1280, 896);
    await expect.element(panel).toBeVisible();
  } finally {
    await page.viewport(414, 896);
  }
});

import { page } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for(['latest', 'revision', 'removed'] as const)(
  'a direct %s review binds Git controls only to its published checkout',
  async (state, { repo, render, server }) => {
    await repo.branch('topic');
    await repo.switch('topic');
    const fixture = await repo.review(
      'Keep Git actions on the published checkout',
      undefined,
      undefined,
      'refs/heads/topic',
    );
    if (state === 'removed') await repo.removeReviewWorktree();
    const main = (await server.project()).worktrees.find((entry) => entry.main);
    if (!main) throw new Error('The fixture main checkout is missing.');
    await page.viewport(1440, 900);
    try {
      const app = await render.route(
        `/reviews/${fixture.reviewId}${state === 'revision' ? '/1' : ''}`,
      );
      await expect
        .element(
          app.page.getByRole('region', { name: 'Briefing', exact: true }),
        )
        .toBeVisible();
      const git = app.page.getByRole('button', {
        name: 'Git actions',
        exact: true,
      });
      if (state === 'removed') {
        await expect.element(git).not.toBeInTheDocument();
        return;
      }
      await git.click();
      const menu = app.page.getByRole('menu');
      await expect
        .element(menu.getByText('No upstream', { exact: true }))
        .toBeVisible();
      await expect
        .element(menu.getByText(/^(?:refs\/heads\/)?topic$/u))
        .toHaveTextContent('refs/heads/topic');
      await expect
        .poll(() => server.gitStatusReadWorktrees())
        .toEqual([
          { path: main.path, branch: 'topic' },
          { path: fixture.worktree, branch: 'refs/heads/topic' },
        ]);
    } finally {
      await page.viewport(414, 896);
    }
  },
);

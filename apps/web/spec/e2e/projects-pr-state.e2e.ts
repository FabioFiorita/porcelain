import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';

for (const width of [1440, 414]) {
  test(`a PR opens in the current workspace and unavailable GitHub state retries without moving its card at ${width}px`, async ({
    pairedPage: page,
    server,
    app,
  }) => {
    const main = (await server.project()).worktrees.find(
      (row) => row.main,
    )?.path;
    if (!main) throw new Error('Missing main checkout');
    const fixture = await archiveFixture(main);
    try {
      await page.setViewportSize({ width, height: 896 });
      await app.reload();
      if (width === 414)
        await page
          .getByRole('button', { name: 'Toggle Sidebar', exact: true })
          .click();
      const sidebar = page.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      });
      const row = sidebar.getByRole('listitem').filter({
        has: page.getByRole('button', { name: /^archive-fixture,/ }),
      });
      await expect(row).toBeVisible();
      const openPullRequest = row.getByRole('button', {
        name: /^Open PR #423/,
      });
      await expect(openPullRequest).toBeVisible();
      fixture.setGitHubFailure('rate-limited');
      const original = app.address().path;
      await openPullRequest.click();
      await expect(
        page.getByRole('tab', { name: 'PR #423', exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      await expect.poll(() => app.address().path).toBe(original);
      await expect(
        page.getByText(/GitHub rate limit reached[.]/),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Try again', exact: true }),
      ).toBeEnabled();
      fixture.setGitHubFailure(undefined);
      await page
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
      await expect(
        page.getByRole('article', { name: 'Pull request #423', exact: true }),
      ).toBeVisible();
      fixture.setGitHubFailure('not-found');
      await app.reload();
      await expect(
        page.getByText(/GitHub could not find this pull request/),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Back to the worktree', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Try again', exact: true }),
      ).toBeEnabled();
      fixture.setGitHubFailure(undefined);
      await page
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
      await expect(
        page.getByRole('article', { name: 'Pull request #423', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Archive', exact: true }).click();
      const dialog = page.getByRole('alertdialog', {
        name: 'Archive pull request?',
        exact: true,
      });
      await expect(dialog).toContainText(`Delete worktree: ${fixture.tree}`);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect.poll(() => fixture.exists()).toBe(true);
    } finally {
      fixture.setGitHubFailure(undefined);
    }
  });
}

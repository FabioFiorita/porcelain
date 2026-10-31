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
    fixture.pullRequestUnavailable(true);
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
      const original = app.address().path;
      await row.getByRole('button', { name: /^Open PR #423/ }).click();
      await expect(
        page.getByRole('tab', { name: 'PR #423', exact: true }),
      ).toHaveAttribute('aria-selected', 'true');
      await expect.poll(() => app.address().path).toBe(original);
      await expect(
        page.getByText(/GitHub rate limit reached[.]/),
      ).toBeVisible();
      fixture.pullRequestUnavailable(false);
      await page
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
      await expect(
        page.getByRole('article', { name: 'Pull request #423', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Archive', exact: true }).click();
      const dialog = page.getByRole('alertdialog', {
        name: 'Archive review?',
        exact: true,
      });
      await expect(dialog).toContainText(`Delete worktree: ${fixture.tree}`);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect.poll(() => fixture.exists()).toBe(true);
    } finally {
      fixture.pullRequestUnavailable(false);
    }
  });
}

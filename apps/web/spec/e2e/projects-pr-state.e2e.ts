import { expect, test } from './fixtures.ts';
import { archiveFixture } from '../kit/archive-fixture.ts';

for (const width of [1440, 414]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`unavailable PR state explains, retries and restores Archive at ${width}px in ${colorScheme}`, async ({
      pairedPage: page,
      server,
      app,
    }) => {
      const project = await server.project();
      const main = project.worktrees.find((row) => row.main)?.path;
      if (!main) throw new Error('Missing main checkout');
      const fixture = await archiveFixture(main);
      fixture.pullRequestUnavailable(true);
      try {
        await page.setViewportSize({ width, height: 896 });
        await page.emulateMedia({ colorScheme });
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
          has: page.getByRole('link', { name: /PR state unavailable/ }),
        });
        await expect(row).toBeVisible();
        await expect(
          sidebar.getByRole('button', { name: /^Needs you/ }),
        ).toBeVisible();
        await expect(
          row.getByRole('button', { name: 'Archive', exact: true }),
        ).not.toBeAttached();
        await sidebar
          .getByRole('button', { name: 'Closed reviews', exact: true })
          .click();
        await expect(
          sidebar.getByText('No closed reviews', { exact: true }),
        ).not.toBeAttached();
        await expect(
          sidebar.getByRole('button', { name: 'Read again', exact: true }),
        ).toBeVisible();
        await sidebar
          .getByRole('button', { name: 'Back to reviews', exact: true })
          .click();
        const status = row.getByRole('button', { name: /^Review status:/ });
        await status.focus();
        await status.press('Enter');
        await expect(page.getByRole('tooltip')).toContainText(
          'PR state unavailable: GitHub rate limit reached.',
        );
        await status.press('Escape');
        await expect(status).toBeFocused();
        await row.getByRole('link').click({ button: 'right' });
        await expect(page.getByRole('menu')).toContainText(
          'GitHub rate limit reached.',
        );
        fixture.pullRequestUnavailable(false);
        await page
          .getByRole('menuitem', {
            name: 'Read pull request again',
            exact: true,
          })
          .click();
        await expect(row).not.toBeAttached();
        await sidebar
          .getByRole('button', { name: 'Closed reviews', exact: true })
          .click();
        const closed = sidebar.getByRole('listitem').filter({
          has: page.getByRole('link', { name: /Completed archive fixture/ }),
        });
        await expect(closed).toBeVisible();
        await closed.getByRole('link').click({ button: 'right' });
        await page
          .getByRole('menuitem', { name: 'Archive', exact: true })
          .click();
        const dialog = page.getByRole('alertdialog', {
          name: 'Archive review?',
          exact: true,
        });
        await expect(dialog).toContainText(`Delete worktree: ${fixture.tree}`);
        await dialog
          .getByRole('button', { name: 'Cancel', exact: true })
          .click();
        await expect.poll(() => fixture.exists()).toBe(true);
      } finally {
        fixture.pullRequestUnavailable(false);
      }
    });
  }
}

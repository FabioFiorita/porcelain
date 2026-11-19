import { expect, test } from './fixtures.ts';
import { closeSettings, openSettingsAtFirstEntry } from '../kit/settings.ts';

for (const predecessor of [false, true]) {
  for (const action of ['Close Settings', 'Escape']) {
    test(`Settings direct-entry history: ${action} returns ${predecessor ? 'to the actual predecessor' : 'to the workspace without a predecessor'} after section navigation`, async ({
      pairedPage,
      app,
    }) => {
      const page = predecessor
        ? pairedPage
        : await openSettingsAtFirstEntry(pairedPage);
      try {
        if (predecessor) {
          await app.follow('/settings-return-predecessor');
          await expect(
            page.getByText('Page not found', { exact: true }),
          ).toBeVisible();
          await page.keyboard.press('Alt+Shift+S');
        }
        const settings = page.getByRole('dialog', {
          name: 'Settings',
          exact: true,
        });
        await expect(
          settings.getByRole('heading', { name: 'General', exact: true }),
        ).toBeVisible();
        await settings
          .getByRole('navigation', { name: 'Settings sections', exact: true })
          .getByRole('button', { name: 'Computers', exact: true })
          .click();
        await expect(
          settings.getByRole('heading', { name: 'Computers', exact: true }),
        ).toBeVisible();
        await settings
          .getByRole('button', { name: /^Open This computer:/u })
          .click();
        await expect(
          settings
            .getByRole('navigation', { name: 'breadcrumb', exact: true })
            .getByText('This computer', { exact: true }),
        ).toBeVisible();
        await settings
          .getByRole('navigation', { name: 'Settings sections', exact: true })
          .getByRole('button', { name: 'General', exact: true })
          .click();
        await settings
          .getByRole('navigation', { name: 'Settings sections', exact: true })
          .getByRole('button', { name: 'Computers', exact: true })
          .click();
        if (action === 'Close Settings') await closeSettings(settings.page());
        else await page.keyboard.press('Escape');
        await expect(settings).not.toBeAttached();
        if (predecessor) {
          await expect(page).toHaveURL(/\/settings-return-predecessor$/);
          await expect(
            page.getByText('Page not found', { exact: true }),
          ).toBeVisible();
        } else {
          await expect(
            page.getByRole('region', { name: 'Review content', exact: true }),
          ).toBeVisible();
          await expect(page).not.toHaveURL(/\/settings\//);
        }
      } finally {
        if (!predecessor) await page.close();
      }
    });
  }
}

test('Close after reloading a computer detail returns to the workspace that opened Settings', async ({
  pairedPage,
  app,
}) => {
  await pairedPage.setViewportSize({ width: 1440, height: 900 });
  const review = pairedPage.getByRole('region', {
    name: 'Review content',
    exact: true,
  });
  await expect(review).toBeVisible();
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  const workspace = pairedPage.url();
  await pairedPage
    .getByRole('navigation', { name: 'Projects and worktrees', exact: true })
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await settings
    .getByRole('button', { name: 'Computers', exact: true })
    .click();
  await settings.getByRole('button', { name: /^Open This computer:/u }).click();
  await expect(pairedPage).toHaveURL(/\/settings\/computers\/this-computer$/);
  await app.reload();
  await expect(
    settings
      .getByRole('navigation', { name: 'breadcrumb', exact: true })
      .getByText('This computer', { exact: true }),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(settings).not.toBeAttached();
  await expect(pairedPage).toHaveURL(workspace);
  await expect(pairedPage).toHaveTitle(/^Changes — /);
  await expect(review).toBeVisible();
});

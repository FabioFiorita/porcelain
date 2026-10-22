import { expect, observeBrowserFailures, test } from './fixtures.ts';

test('touch opens the sidebar without holding a tooltip', async ({
  browser,
  pairedPage,
  app,
  observed,
}) => {
  const context = await browser.newContext({
    baseURL: new URL(pairedPage.url()).origin,
    hasTouch: true,
    viewport: { width: 414, height: 896 },
  });
  observeBrowserFailures(context, observed);
  try {
    const page = await context.newPage();
    await page.goto(await app.link('this'));
    await expect(
      page.getByRole('region', { name: 'Review content', exact: true }),
    ).toBeVisible();
    await page.goto('/shortcut-hints');
    const toggle = page.getByRole('button', {
      name: 'Toggle Sidebar',
      exact: true,
    });
    const tooltip = page.getByText('Toggle sidebarCtrl+B', { exact: true });
    await toggle.tap();
    await expect(
      page.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      }),
    ).toBeVisible();
    await expect(tooltip).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open project', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page
      .getByRole('heading', { name: 'Page not found', exact: true })
      .tap();
    await expect(tooltip).not.toBeVisible();
  } finally {
    await context.close();
  }
});

for (const width of [1280, 414]) {
  test(`the sidebar toggle and shortcuts dialog at ${width}px`, async ({
    pairedPage: page,
    app,
  }) => {
    await page.setViewportSize({ width, height: 896 });
    await page.emulateMedia({ colorScheme: 'light' });
    await app.follow('/shortcut-hints');
    const toggle = page.getByRole('button', {
      name: 'Toggle Sidebar',
      exact: true,
    });
    await expect(toggle).toHaveAccessibleName('Toggle Sidebar');
    const tooltip = page.getByText('Toggle sidebarCtrl+B', { exact: true });
    await expect(toggle).toHaveAttribute('aria-keyshortcuts', 'Control+B');
    await expect(toggle).not.toHaveAttribute('title');
    await toggle.hover();
    await expect(tooltip).toHaveText('Toggle sidebarCtrl+B');
    await expect(tooltip.getByText('Ctrl+B', { exact: true })).toBeVisible();
    await page.mouse.move(width - 20, 800);
    await toggle.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await expect(tooltip).toHaveText('Toggle sidebarCtrl+B');
    await expect(tooltip.getByText('Ctrl+B', { exact: true })).toBeVisible();

    const expanded = width >= 768 ? 'true' : 'false';
    await expect(toggle).toHaveAttribute('aria-expanded', expanded);
    await page.keyboard.press('Control+b');
    if (width >= 768) {
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Control+b');
    }
    const footer = page.getByRole('button', {
      name: 'Keyboard shortcuts',
      exact: true,
    });
    await footer.click();
    const dialog = page.getByRole('dialog', {
      name: 'Keyboard shortcuts',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const workspace = dialog.getByRole('region', {
      name: 'Workspace',
      exact: true,
    });
    await expect(
      workspace.getByText('Close Settings', { exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByRole('definition').filter({ hasText: /^Esc$/ }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Close', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(footer).toBeFocused();
    await page.keyboard.press('Control+/');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Close', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(footer).toBeFocused();

    const search = page.getByRole('searchbox', {
      name: 'Search reviews and worktrees',
      exact: true,
    });
    await search.fill('typing');
    await page.keyboard.press('Control+/');
    await expect(dialog).not.toBeVisible();
    await search.fill('');
    await footer.focus();
    await page.keyboard.press('Alt+Shift+s');
    const settings = page.getByRole('main', {
      name: 'Settings',
      exact: true,
    });
    await expect(settings).toBeVisible();
    await settings
      .getByRole('button', { name: 'Computers', exact: true })
      .click();
    const input = settings.getByRole('textbox', {
      name: 'Pairing link',
      exact: true,
    });
    await input.fill('typing');
    await page.keyboard.press('Escape');
    await expect(settings).toBeVisible();
    await settings.focus();
    await page.keyboard.press('Escape');
    await expect(settings).not.toBeVisible();
    await expect(page).toHaveURL(/\/shortcut-hints$/);
    if (width === 414) {
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(
        page.getByRole('navigation', {
          name: 'Projects and worktrees',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Open project', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
      await expect(tooltip).toBeVisible();
      await page.mouse.move(width - 20, 800);
      await page
        .getByRole('heading', { name: 'Page not found', exact: true })
        .click();
      await expect(tooltip).not.toBeVisible();
    }
  });
}

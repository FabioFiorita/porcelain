import { expect, test } from '../e2e/fixtures.ts';

export function routingPromises() {
  test('unknown URLs keep the app navigator and a link back to the workspace', async ({
    app,
    pairedPage,
    server,
  }) => {
    const project = await server.project();
    const workspace = app.address().path;
    for (const path of [
      '/nonexistent-route',
      `${workspace}/remotes`,
      '/settings/appearance/extra',
      '/settings/unknown/extra',
    ]) {
      await app.open(path);
      await expect(
        pairedPage.getByText('Page not found', { exact: true }),
      ).toBeVisible();
      await expect.poll(() => app.address().path).toBe(path);
      await pairedPage
        .getByRole('button', { name: 'Toggle Sidebar', exact: true })
        .click();
      const navigator = pairedPage.getByRole('navigation', {
        name: 'Projects and worktrees',
        exact: true,
      });
      await expect(
        navigator.getByRole('button', { name: project.name, exact: true }),
      ).toBeVisible();
      await expect(
        navigator.getByRole('button', { name: 'Settings', exact: true }),
      ).toBeVisible();
      await pairedPage.keyboard.press('Escape');
      await pairedPage
        .getByRole('link', { name: 'Back to workspace', exact: true })
        .click();
      await expect.poll(() => app.address().path).toBe(workspace);
      await expect(
        pairedPage.getByRole('region', { name: 'Review content', exact: true }),
      ).toBeVisible();
    }
  });

  test('Settings without a section opens the default', async ({
    app,
    pairedPage,
    shell,
  }) => {
    await app.open('/settings');
    await expect
      .poll(() => app.address().path)
      .toBe(
        shell === 'desktop' ? '/settings/computer' : '/settings/appearance',
      );
    await expect(
      pairedPage.getByRole('heading', {
        name: shell === 'desktop' ? 'This computer' : 'Appearance',
        exact: true,
      }),
    ).toBeVisible();
  });

  test('unknown Settings sections show a recoverable not-found without silently redirecting', async ({
    app,
    pairedPage,
    shell,
  }) => {
    for (const path of shell === 'desktop'
      ? ['/settings/unknown']
      : ['/settings/unknown', '/settings/remotes', '/settings/devices']) {
      await app.open(path);
      await expect(
        pairedPage.getByText('Page not found', { exact: true }),
      ).toBeVisible();
      await expect.poll(() => app.address().path).toBe(path);
      await pairedPage.keyboard.press('Alt+Shift+S');
      await expect(
        pairedPage.getByRole('main', { name: 'Settings', exact: true }),
      ).toBeVisible();
      await pairedPage
        .getByRole('button', { name: 'Back', exact: true })
        .click();
      await expect(
        pairedPage.getByText('Page not found', { exact: true }),
      ).toBeVisible();
      await pairedPage
        .getByRole('link', { name: 'Back to workspace', exact: true })
        .click();
      await expect(
        pairedPage.getByRole('region', { name: 'Review content', exact: true }),
      ).toBeVisible();
    }
  });

  test('an invalid worktree ID explains the URL and directly opens an available worktree', async ({
    app,
    pairedPage,
    server,
  }) => {
    const project = await server.project();
    const workspace = app.address().path;
    for (const path of [
      `/${project.id}/invalid-worktree`,
      `/${project.id}/remotes`,
      '/?worktree=invalid-worktree',
    ]) {
      await app.open(path);
      await expect(
        pairedPage.getByText('Worktree not found', { exact: true }),
      ).toBeVisible();
      await expect(
        pairedPage.getByText(
          'This URL has an invalid or unavailable worktree ID.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        pairedPage.getByRole('region', { name: 'Review content', exact: true }),
      ).not.toBeAttached();
      const recovery = pairedPage.getByRole('link', {
        name: 'Open available worktree',
        exact: true,
      });
      await expect(recovery).toHaveAttribute('href', workspace);
      await recovery.click();
      await expect.poll(() => app.address().path).toBe(workspace);
      await expect(
        pairedPage.getByRole('region', { name: 'Review content', exact: true }),
      ).toBeVisible();
    }
  });

  test('unknown URLs still require pairing', async ({ app, page }) => {
    await app.open('/nonexistent-route');
    await expect.poll(() => app.address().path).toBe('/pair');
    await expect(
      page.getByRole('heading', {
        name: 'This browser is not paired',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Page not found', { exact: true }),
    ).not.toBeAttached();
  });
}

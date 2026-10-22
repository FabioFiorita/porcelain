import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'the owner updates Porcelain from Settings, sees a failed update keep the running version and why, then updates to the new version at %i px',
  async (width, { render, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const app = await render.route('/settings/computers/this-computer');
      const page = app.page;

      const name = (await server.inventory()).environment.name;
      const offered = await server.serviceUpdate();
      const from = offered.version ?? '';
      const to = offered.latest ?? '';
      const settings = page.getByRole('main', {
        name: 'Settings',
        exact: true,
      });

      await expect
        .element(settings.getByText(`Porcelain ${from}`, { exact: true }))
        .toBeVisible();
      await expect
        .element(
          settings.getByText(`Porcelain ${from} → ${to}`, { exact: true }),
        )
        .toBeVisible();

      const update = settings.getByRole('button', {
        name: `Update ${name}`,
        exact: true,
      });
      await update.click();
      await expect
        .element(
          settings.getByText(new RegExp(`^(Downloading|Installing) ${to}`)),
        )
        .toBeVisible();
      await expect
        .element(
          settings.getByText(
            'Could not install the persistent runtime: npm could not reach the registry',
            { exact: true },
          ),
        )
        .toBeVisible();
      await expect
        .element(settings.getByText(`Porcelain ${from}`, { exact: true }))
        .toBeVisible();

      await update.click();
      await expect
        .element(
          settings.getByText(
            new RegExp(
              `^(Downloading|Installing|Restarting Porcelain on) ${to}`,
            ),
          ),
        )
        .toBeVisible();
      await expect
        .element(settings.getByText(`Updated to ${to}.`, { exact: true }))
        .toBeVisible();
      await expect
        .element(settings.getByText(`Porcelain ${to}`, { exact: true }))
        .toBeVisible();
      await expect
        .element(settings.getByText('Up to date', { exact: true }))
        .toBeVisible();
      await expect
        .element(settings.getByRole('button', { name: 'Reload', exact: true }))
        .toBeVisible();
      await expect
        .poll(async () => (await server.serviceUpdate()).version)
        .toBe(to);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test.for([1440, 414])(
  'an open update check drops its badge on failure and recovers with Try again at %i px',
  async (width, { render, repo, server }) => {
    await browserPage.viewport(width, 896);
    const offered = await server.serviceUpdate();
    try {
      const page = await render.navigator();
      const update = page.getByRole('button', { name: 'Update', exact: true });
      await expect.element(update).toBeVisible();
      const before = await server.serviceUpdateReads();
      await repo.serviceUpdate('error');
      await update.click();
      await expect.poll(() => server.serviceUpdateReads()).toBe(before + 1);
      await expect
        .element(page.getByText('The update check failed', { exact: true }))
        .toBeVisible();
      await expect.element(update).not.toBeInTheDocument();
      await expect
        .element(page.getByText('Updates available', { exact: true }))
        .not.toBeInTheDocument();
      await expect
        .element(
          page.getByRole('button', { name: 'Update all (0)', exact: true }),
        )
        .toBeDisabled();
      await repo.serviceUpdate(offered);
      await page
        .getByRole('button', { name: 'Try again', exact: true })
        .click();
      await expect
        .element(page.getByText('Updates available', { exact: true }))
        .toBeVisible();
      await expect.element(update).toBeVisible();
      await expect
        .element(
          page.getByRole('button', { name: 'Update all (1)', exact: true }),
        )
        .toBeEnabled();
      await expect.poll(() => server.serviceUpdateReads()).toBe(before + 2);
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

test('Computers refreshes settled service status once and exposes recovery after a failed check', async ({
  render,
  repo,
  server,
}) => {
  const offered = await server.serviceUpdate();
  const app = await render.route('/');
  await app.page
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await expect.poll(() => server.serviceUpdateReads()).toBe(1);
  await repo.serviceUpdate('error');
  await app.navigate('/settings/computers');
  const settings = app.page.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await expect
    .element(settings.getByRole('button', { name: 'Try again', exact: true }))
    .toBeVisible();
  await expect.poll(() => server.serviceUpdateReads()).toBe(2);
  await repo.serviceUpdate(offered);
  await settings
    .getByRole('button', { name: 'Try again', exact: true })
    .click();
  await expect
    .element(settings.getByText('Porcelain 1.0.0 → 1.1.0', { exact: true }))
    .toBeVisible();
  await expect.poll(() => server.serviceUpdateReads()).toBe(3);
});

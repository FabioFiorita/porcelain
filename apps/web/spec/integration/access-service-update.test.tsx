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

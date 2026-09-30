import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the owner updates Porcelain from Settings, sees a failed update keep the running version and why, then updates to the new version', async ({
  pairedPage,
  server,
}) => {
  const offered = await server.serviceUpdate();
  const from = offered.version ?? '';
  const to = offered.latest ?? '';
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('dialog', {
    name: 'Settings',
    exact: true,
  });
  await expect
    .element(settings.getByText(`Porcelain ${from}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      settings.getByText(`Porcelain ${to} is available.`, { exact: true }),
    )
    .toBeVisible();

  const update = settings.getByRole('button', {
    name: `Update to ${to}`,
    exact: true,
  });
  await update.click();
  await expect
    .element(settings.getByText(new RegExp(`^(Downloading|Installing) ${to}`)))
    .toBeVisible();
  await expect
    .element(
      settings.getByText(
        `The update to ${to} failed, so Porcelain still runs ${from}.`,
        { exact: true },
      ),
    )
    .toBeVisible();
  const failed = await server.serviceUpdate();
  await expect
    .element(settings.getByText(failed.last?.reason ?? '', { exact: true }))
    .toBeVisible();

  await update.click();
  await expect
    .element(
      settings.getByText(
        new RegExp(`^(Downloading|Installing|Restarting Porcelain on) ${to}`),
      ),
    )
    .toBeVisible();
  await expect
    .element(
      settings.getByText(new RegExp(`^Updated from ${from} to ${to}\\.`)),
    )
    .toBeVisible();
  await expect
    .element(settings.getByText(`Porcelain ${to}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(settings.getByText('This is the newest version.', { exact: true }))
    .toBeVisible();
  await expect
    .element(settings.getByRole('button', { name: 'Reload', exact: true }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.serviceUpdate()).version)
    .toBe(to);
});

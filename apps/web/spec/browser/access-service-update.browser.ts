import { expect } from 'vitest';
import { test } from '../kit/journey';

test('the owner updates Porcelain from Settings, sees a failed update keep the running version and why, then updates to the new version', async ({
  pairedPage,
  server,
}) => {
  const offered = await server.serviceUpdate();
  const from = offered.version ?? '';
  const to = offered.latest ?? '';
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  await expect.element(settings.getByText(`Porcelain ${from}`)).toBeVisible();
  await expect
    .element(settings.getByText(`Porcelain ${to} is available.`))
    .toBeVisible();

  const update = settings.getByRole('button', { name: `Update to ${to}` });
  await update.click();
  await expect
    .element(settings.getByText(new RegExp(`^(Downloading|Installing) ${to}`)))
    .toBeVisible();
  await expect
    .element(
      settings.getByText(
        `The update to ${to} failed, so Porcelain still runs ${from}.`,
      ),
    )
    .toBeVisible();
  const failed = await server.serviceUpdate();
  await expect
    .element(settings.getByText(failed.last?.reason ?? ''))
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
      settings.getByText(`Updated from ${from} to ${to}.`, { exact: false }),
    )
    .toBeVisible();
  await expect
    .element(settings.getByText(`Porcelain ${to}`, { exact: true }))
    .toBeVisible();
  await expect
    .element(settings.getByText('This is the newest version.'))
    .toBeVisible();
  await expect
    .element(settings.getByRole('button', { name: 'Reload' }))
    .toBeVisible();
  await expect
    .poll(async () => (await server.serviceUpdate()).version)
    .toBe(to);
});

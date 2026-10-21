import { openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('the owner updates Porcelain from Settings, sees a failed update keep the running version and why, then updates to the new version', async ({
  pairedPage,
  server,
}) => {
  const name = (await server.inventory()).environment.name;
  const offered = await server.serviceUpdate();
  const from = offered.version ?? '';
  const to = offered.latest ?? '';
  await pairedPage
    .getByRole('button', { name: 'Toggle Sidebar', exact: true })
    .click();
  await pairedPage
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await openThisComputer(pairedPage);
  await expect(
    settings.getByText(`Porcelain ${from}`, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText(`Porcelain ${from} → ${to}`, { exact: true }),
  ).toBeVisible();

  const update = settings.getByRole('button', {
    name: `Update ${name}`,
    exact: true,
  });
  await update.click();
  await expect(
    settings.getByText(new RegExp(`^(Downloading|Installing) ${to}`)),
  ).toBeVisible();
  await expect(
    settings.getByText(
      'Could not install the persistent runtime: npm could not reach the registry',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    settings.getByText(`Porcelain ${from}`, { exact: true }),
  ).toBeVisible();

  await update.click();
  await expect(
    settings.getByText(
      new RegExp(`^(Downloading|Installing|Restarting Porcelain on) ${to}`),
    ),
  ).toBeVisible();
  await expect(
    settings.getByText(`Updated to ${to}.`, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText(`Porcelain ${to}`, { exact: true }),
  ).toBeVisible();
  await expect(settings.getByText('Up to date', { exact: true })).toBeVisible();
  await expect(
    settings.getByRole('button', { name: 'Reload', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await server.serviceUpdate()).version)
    .toBe(to);
});

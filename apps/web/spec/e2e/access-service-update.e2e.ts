import { expect, test } from './fixtures.ts';

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
  const settings = pairedPage.getByRole('main', {
    name: 'Settings',
    exact: true,
  });
  await pairedPage
    .getByRole('main', { name: 'Settings', exact: true })
    .getByRole('button', { name: 'Updates', exact: true })
    .click();
  await expect(
    settings.getByText(`Porcelain ${from}`, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText(`Porcelain ${to} is available.`, { exact: true }),
  ).toBeVisible();

  const update = settings.getByRole('button', {
    name: `Update to ${to}`,
    exact: true,
  });
  await update.click();
  await expect(
    settings.getByText(new RegExp(`^(Downloading|Installing) ${to}`)),
  ).toBeVisible();
  await expect(
    settings.getByText(
      `The update to ${to} failed, so Porcelain still runs ${from}.`,
      { exact: true },
    ),
  ).toBeVisible();
  const failed = await server.serviceUpdate();
  await expect(
    settings.getByText(failed.last?.reason ?? '', { exact: true }),
  ).toBeVisible();

  await update.click();
  await expect(
    settings.getByText(
      new RegExp(`^(Downloading|Installing|Restarting Porcelain on) ${to}`),
    ),
  ).toBeVisible();
  await expect(
    settings.getByText(
      `Updated from ${from} to ${to}. Reload to use the new version here.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    settings.getByText(`Porcelain ${to}`, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText('This is the newest version.', { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole('button', { name: 'Reload', exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await server.serviceUpdate()).version)
    .toBe(to);
});

import { expect, test } from './fixtures.ts';

test('Settings → Devices creates a one-time pairing link for one way in with its QR code, lists the paired devices with the way in each works through and revokes one', async ({
  pairedPage,
  server,
}) => {
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
    .getByRole('button', { name: 'Devices', exact: true })
    .click();
  await expect(
    settings.getByText(
      'Turn on a way in under Ways in to pair a phone or another computer.',
      { exact: true },
    ),
  ).toBeVisible();

  await settings.getByRole('button', { name: 'Ways in', exact: true }).click();
  await settings
    .getByRole('switch', { name: 'Local network', exact: true })
    .click();
  await expect(
    settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Devices', exact: true }).click();

  await expect(
    settings.getByText(
      'The device will work only through Local network. To use it through another way in too, pair it again through that one.',
      { exact: true },
    ),
  ).toBeVisible();
  await settings.getByLabel('Device name', { exact: true }).fill('My phone');
  await settings
    .getByRole('button', { name: 'Create pairing link', exact: true })
    .click();
  await expect(
    settings.getByRole('img', { name: 'Pairing QR code', exact: true }),
  ).toBeVisible();
  await expect(settings.getByLabel('Pairing link', { exact: true })).toHaveText(
    /^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/,
  );
  await expect
    .poll(async () => (await server.pendingLinks()).map((link) => link.label))
    .toEqual(['My phone']);

  const devices = settings.getByRole('list', {
    name: 'Paired devices and links',
    exact: true,
  });
  await expect(
    devices.getByRole('listitem', { name: 'Journey browser', exact: true }),
  ).toHaveText(/This browserThis computer/);
  await expect
    .poll(async () => (await server.devices()).map((device) => device.route))
    .toEqual(['loopback', 'loopback']);
  await expect(
    devices.getByRole('button', {
      name: 'Revoke Journey browser',
      exact: true,
    }),
  ).not.toBeAttached();
  await expect(
    devices.getByRole('listitem', { name: 'My phone', exact: true }),
  ).toHaveText(/Pending link/);

  await devices
    .getByRole('button', { name: 'Revoke Development setup', exact: true })
    .click();
  await expect(
    devices.getByRole('listitem', { name: 'Development setup', exact: true }),
  ).not.toBeAttached();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toEqual(['Journey browser']);
});

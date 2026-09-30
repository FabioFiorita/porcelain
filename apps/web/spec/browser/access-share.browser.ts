import { expect } from 'vitest';
import { test } from '../kit/journey';

test('sharing from Settings creates a one-time pairing link for one way in with its QR code, lists the paired devices with the way in each works through and revokes one', async ({
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
    .getByRole('button', { name: 'Sharing', exact: true })
    .click();
  await expect
    .element(
      settings.getByText(
        'Turn on a way in above to pair a phone or another computer.',
        { exact: true },
      ),
    )
    .toBeVisible();

  await settings
    .getByRole('switch', { name: 'Local network', exact: true })
    .click();
  await expect
    .element(settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/))
    .toBeVisible();

  await expect
    .element(
      settings.getByText(
        'The device will work only through Local network. To use it through another way in too, pair it again through that one.',
        { exact: true },
      ),
    )
    .toBeVisible();
  await settings
    .getByLabelText('Device name', { exact: true })
    .fill('My phone');
  await settings
    .getByRole('button', { name: 'Create pairing link', exact: true })
    .click();
  await expect
    .element(
      settings.getByRole('img', { name: 'Pairing QR code', exact: true }),
    )
    .toBeVisible();
  await expect
    .element(settings.getByLabelText('Pairing link', { exact: true }))
    .toMatchTextContent(/^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/);
  await expect
    .poll(async () => (await server.pendingLinks()).map((link) => link.label))
    .toEqual(['My phone']);

  const devices = settings.getByRole('list', {
    name: 'Paired devices and links',
    exact: true,
  });
  await expect
    .element(
      devices.getByRole('listitem', { name: 'Journey browser', exact: true }),
    )
    .toMatchTextContent(/This browserThis computer/);
  await expect
    .poll(async () => (await server.devices()).map((device) => device.route))
    .toEqual(['loopback', 'loopback']);
  await expect
    .element(
      devices.getByRole('button', {
        name: 'Revoke Journey browser',
        exact: true,
      }),
    )
    .not.toBeInTheDocument();
  await expect
    .element(devices.getByRole('listitem', { name: 'My phone', exact: true }))
    .toMatchTextContent(/Pending link/);

  await devices
    .getByRole('button', { name: 'Revoke Development setup', exact: true })
    .click();
  await expect
    .element(
      devices.getByRole('listitem', { name: 'Development setup', exact: true }),
    )
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toEqual(['Journey browser']);
}, 30_000);

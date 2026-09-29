import { expect } from 'vitest';
import { test } from '../kit/journey';

test('sharing from Settings creates a one-time pairing link with its QR code, lists the paired devices and revokes one', async ({
  pairedPage,
  server,
}) => {
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  await expect
    .element(
      settings.getByText(
        'Turn on a way in above to pair a phone or another computer.',
      ),
    )
    .toBeVisible();

  await settings.getByRole('switch', { name: 'Local network' }).click();
  await expect
    .element(settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/))
    .toBeVisible();

  await settings.getByLabelText('Device name').fill('My phone');
  await settings.getByRole('button', { name: 'Create pairing link' }).click();
  await expect
    .element(settings.getByRole('img', { name: 'Pairing QR code' }))
    .toBeVisible();
  await expect
    .element(settings.getByLabelText('Pairing link'))
    .toMatchTextContent(/^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/);
  await expect
    .poll(async () => (await server.pendingLinks()).map((link) => link.label))
    .toEqual(['My phone']);

  const devices = settings.getByRole('list', {
    name: 'Paired devices and links',
  });
  await expect
    .element(devices.getByRole('listitem', { name: 'Journey browser' }))
    .toMatchTextContent(/This browser/);
  await expect
    .element(devices.getByRole('button', { name: 'Revoke Journey browser' }))
    .not.toBeInTheDocument();
  await expect
    .element(devices.getByRole('listitem', { name: 'My phone' }))
    .toMatchTextContent(/Pending link/);

  await devices
    .getByRole('button', { name: 'Revoke Development setup' })
    .click();
  await expect
    .element(devices.getByRole('listitem', { name: 'Development setup' }))
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.devices()).map((device) => device.label))
    .toEqual(['Journey browser']);
}, 30_000);

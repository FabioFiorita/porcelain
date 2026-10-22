import { openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

test('Settings → Computers → This computer creates a one-time pairing link for one way in with its QR code, lists the paired devices with the way in each works through and revokes one', async ({
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
  await openThisComputer(pairedPage);
  await expect(
    settings.getByText(
      'Turn on a way in under Computers → This computer → Ways in to pair a phone or another computer.',
      { exact: true },
    ),
  ).toBeVisible();

  await openThisComputer(pairedPage);
  await settings
    .getByRole('switch', { name: 'Local network', exact: true })
    .click();
  await expect(
    settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/),
  ).toBeVisible();

  await expect(
    settings.getByText(
      'The link opens through Local network. The device will work only through the way in it pairs over. To use it through another way in too, pair it again through that one.',
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
  await expect(
    settings.getByText(/^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/),
  ).toHaveText(/^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/);
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

for (const trusted of [false, true]) {
  test(`cancelling a ${trusted ? 'trusted' : 'standard'} pending link clears its QR and returns to the pairing form`, async ({
    pairedPage,
    server,
  }) => {
    await pairedPage
      .getByRole('button', { name: 'Toggle Sidebar', exact: true })
      .click();
    await pairedPage
      .getByRole('button', { name: 'Settings', exact: true })
      .click();
    await openThisComputer(pairedPage);
    const settings = pairedPage.getByRole('main', {
      name: 'Settings',
      exact: true,
    });
    await settings
      .getByRole('switch', { name: 'Local network', exact: true })
      .click();
    const name = settings.getByRole('textbox', {
      name: 'Device name',
      exact: true,
    });
    await name.fill('Keep this link');
    await settings
      .getByRole('button', { name: 'Create pairing link', exact: true })
      .click();
    await expect(
      settings.getByText('Scan on Keep this link', { exact: true }),
    ).toBeVisible();
    await name.fill('Cancel this link');
    if (trusted)
      await settings
        .getByRole('switch', {
          name: 'The paired device can update Porcelain',
          exact: true,
        })
        .click();
    await settings
      .getByRole('button', { name: 'Create pairing link', exact: true })
      .click();
    await expect(
      settings.getByText('Scan on Cancel this link', { exact: true }),
    ).toBeVisible();
    await settings
      .getByRole('button', {
        name: 'Cancel the link for Cancel this link',
        exact: true,
      })
      .click();
    await expect
      .poll(async () => (await server.pendingLinks()).map((link) => link.label))
      .toEqual(['Keep this link']);
    await expect(
      settings.getByRole('img', { name: 'Pairing QR code', exact: true }),
    ).not.toBeAttached();
    await expect(
      settings.getByText(/^http:\/\/192\.168\.1\.20:\d+\/pair#c=pcp_/),
    ).not.toBeAttached();
    await expect(
      settings.getByRole('button', { name: 'Copy link', exact: true }),
    ).not.toBeAttached();
    await expect(
      settings.getByText('Scan on Cancel this link', { exact: true }),
    ).not.toBeAttached();
    await expect(name).toBeVisible();
    await expect(
      settings.getByRole('button', {
        name: 'Create pairing link',
        exact: true,
      }),
    ).toBeEnabled();
    await settings
      .getByRole('button', { name: 'Create pairing link', exact: true })
      .click();
    await expect(
      settings.getByText('Scan on Cancel this link', { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        (await server.pendingLinks()).map((link) => link.label).sort(),
      )
      .toEqual(['Cancel this link', 'Keep this link']);
  });
}

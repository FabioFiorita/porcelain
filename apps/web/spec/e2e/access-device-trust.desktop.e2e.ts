import { expect, test } from './fixtures.ts';

test('on Devices the owner lets a paired device update Porcelain and creates a pairing link whose device may update it too', async ({
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
  await settings.getByRole('button', { name: 'Ways in', exact: true }).click();
  await settings
    .getByRole('switch', { name: 'Local network', exact: true })
    .click();
  await expect(
    settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/),
  ).toBeVisible();
  await settings.getByRole('button', { name: 'Devices', exact: true }).click();

  const trusted = async (label: string) =>
    (await server.devices()).find((device) => device.label === label)?.trusted;
  const development = settings.getByRole('switch', {
    name: 'Development setup can update Porcelain',
    exact: true,
  });
  await expect(development).not.toBeChecked();
  await development.click();
  await expect(development).toBeChecked();
  await expect.poll(() => trusted('Development setup')).toBe(true);
  await development.click();
  await expect.poll(() => trusted('Development setup')).toBe(false);

  await settings
    .getByLabel('Device name', { exact: true })
    .fill('Release laptop');
  await settings
    .getByRole('switch', {
      name: 'The paired device can update Porcelain',
      exact: true,
    })
    .click();
  await settings
    .getByRole('button', { name: 'Create pairing link', exact: true })
    .click();
  await expect
    .poll(async () =>
      (await server.pendingLinks()).map((link) => [link.label, link.trusted]),
    )
    .toEqual([['Release laptop', true]]);
});

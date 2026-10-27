import { openThisComputer } from '../kit/settings.ts';
import { expect, test } from './fixtures.ts';

const TUNNEL_HOST = 'porcelain.example.com';

test('on This computer the owner lets a device paired through a tunnel edit ways in, sees which device can, and takes it back without touching update trust, while a device bound to the computer’s own address has no such switch', async ({
  pairedPage,
  server,
  world,
}) => {
  await world.changeWaysIn({
    cloudflare: true,
    cloudflareHostname: TUNNEL_HOST,
  });
  await expect
    .poll(async () => (await server.remoteAccess()).routes.cloudflare.status)
    .toMatchObject({ kind: 'on' });
  await world.pairThrough(TUNNEL_HOST, 'Tunnel phone');
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

  const stored = async (label: string) => {
    const device = (await server.devices()).find(
      (entry) => entry.label === label,
    );
    return [device?.canEditWaysIn, device?.trusted];
  };
  const waysIn = settings.getByRole('switch', {
    name: 'Tunnel phone can edit ways in',
    exact: true,
  });
  const update = settings.getByRole('switch', {
    name: 'Tunnel phone can update Porcelain',
    exact: true,
  });
  await expect(
    settings.getByRole('switch', {
      name: 'Development setup can update Porcelain',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    settings.getByRole('switch', {
      name: 'Development setup can edit ways in',
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(waysIn).not.toBeChecked();
  await expect(update).not.toBeChecked();

  await waysIn.click();
  await expect(waysIn).toBeChecked();
  await expect(update).not.toBeChecked();
  await expect.poll(() => stored('Tunnel phone')).toEqual([true, false]);

  await pairedPage.reload();
  await expect(waysIn).toBeChecked();

  await waysIn.click();
  await expect(waysIn).not.toBeChecked();
  await expect.poll(() => stored('Tunnel phone')).toEqual([false, false]);
});

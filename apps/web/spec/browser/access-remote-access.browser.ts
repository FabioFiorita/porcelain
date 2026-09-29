import { expect } from 'vitest';
import { test } from '../kit/journey';

test('turning the ways in on and off from Settings shows each one starting, then serving its address or failing with a reason', async ({
  pairedPage,
  server,
}) => {
  await pairedPage.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await pairedPage.getByRole('button', { name: 'Settings' }).click();
  const settings = pairedPage.getByRole('dialog', { name: 'Settings' });
  const lan = settings.getByRole('switch', { name: 'Local network' });
  await expect.element(lan).not.toBeChecked();

  await lan.click();
  await expect.element(lan).toBeChecked();
  await expect
    .element(settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/))
    .toBeVisible();
  await expect
    .poll(async () => (await server.remoteAccess()).routes.lan)
    .toMatchObject({ enabled: true, status: { kind: 'on' } });

  await settings.getByRole('switch', { name: 'Tailscale' }).click();
  await expect
    .element(settings.getByText('Tailscale is not connected on this computer.'))
    .toBeVisible();

  const tunnel = settings.getByRole('switch', { name: 'Cloudflare tunnel' });
  await expect.element(tunnel).toBeDisabled();
  await settings
    .getByRole('textbox', { name: 'Public hostname' })
    .fill('https://Porcelain.Example.com/');
  await settings.getByRole('button', { name: 'Save hostname' }).click();
  await expect.element(tunnel).toBeChecked();
  await expect
    .element(settings.getByText('https://porcelain.example.com'))
    .toBeVisible();
  await expect
    .poll(async () => (await server.remoteAccess()).routes.cloudflare)
    .toEqual({
      enabled: true,
      status: { kind: 'on', urls: ['https://porcelain.example.com'] },
    });

  await lan.click();
  await expect.element(lan).not.toBeChecked();
  await expect
    .element(settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/))
    .not.toBeInTheDocument();
  await expect
    .poll(async () => (await server.remoteAccess()).routes.lan)
    .toEqual({ enabled: false, status: { kind: 'off' } });
}, 30_000);

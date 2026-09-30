import { expect } from 'vitest';
import { test } from '../kit/journey';

test('turning the ways in on and off from Settings shows each one starting, then serving its address, the tailnet over HTTPS at the Tailscale name the owner saves with the one tailscale serve command to run, and the local network warns it is not encrypted and names its one network', async ({
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
  const lan = settings.getByRole('switch', {
    name: 'Local network',
    exact: true,
  });
  await expect.element(lan).not.toBeChecked();
  await expect
    .element(
      settings.getByRole('note', {
        name: 'Local network warning',
        exact: true,
      }),
    )
    .toMatchTextContent(
      'Not encryptedAnyone on the same network can read what Porcelain shows and the device credentials it sends. For an encrypted connection, use Tailscale.',
    );
  await expect
    .element(
      settings.getByText(
        'Turning it on listens on 192.168.1.0/24 on eth0 only, and pauses on any other network.',
        { exact: true },
      ),
    )
    .toBeVisible();

  await lan.click();
  await expect.element(lan).toBeChecked();
  await expect
    .element(settings.getByText(/^http:\/\/192\.168\.1\.20:\d+$/))
    .toBeVisible();
  await expect
    .element(
      settings.getByText('Listening on 192.168.1.0/24 on eth0 only.', {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .poll(async () => await server.remoteAccess())
    .toMatchObject({
      routes: { lan: { enabled: true, status: { kind: 'on' } } },
      lanNetwork: { interfaceName: 'eth0', subnet: '192.168.1.0/24' },
    });

  const tailnet = settings.getByRole('switch', {
    name: 'Tailscale',
    exact: true,
  });
  await expect.element(tailnet).toBeDisabled();
  await settings
    .getByRole('textbox', { name: 'Tailscale name', exact: true })
    .fill('Porcelain.Tail0000.ts.net');
  await settings
    .getByRole('button', { name: 'Save name', exact: true })
    .click();
  await expect.element(tailnet).toBeChecked();
  await expect
    .element(
      settings.getByText('https://porcelain.tail0000.ts.net', { exact: true }),
    )
    .toBeVisible();
  await expect
    .element(
      settings.getByText(
        'tailscale serve --bg --https=443 http://127.0.0.1:41000',
        { exact: true },
      ),
    )
    .toBeVisible();
  await expect
    .poll(async () => (await server.remoteAccess()).routes.tailnet)
    .toEqual({
      enabled: true,
      status: { kind: 'on', urls: ['https://porcelain.tail0000.ts.net'] },
    });

  const tunnel = settings.getByRole('switch', {
    name: 'Cloudflare tunnel',
    exact: true,
  });
  await expect.element(tunnel).toBeDisabled();
  await settings
    .getByRole('textbox', { name: 'Public hostname', exact: true })
    .fill('https://Porcelain.Example.com/');
  await settings
    .getByRole('button', { name: 'Save hostname', exact: true })
    .click();
  await expect.element(tunnel).toBeChecked();
  await expect
    .element(
      settings.getByText('https://porcelain.example.com', { exact: true }),
    )
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

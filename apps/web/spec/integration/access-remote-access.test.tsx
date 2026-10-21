import { page as browserPage } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test.for([1280, 414])(
  'the owner switches LAN, Tailscale and tunnel routes with normalized addresses and network warnings at %i px',
  async (width, { render, server }) => {
    await browserPage.viewport(width, 896);
    try {
      const app = await render.route('/settings/computers/this-computer');
      const page = app.page;

      const settings = page.getByRole('main', {
        name: 'Settings',
        exact: true,
      });

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
        .toHaveTextContent(
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
          settings.getByText('https://porcelain.tail0000.ts.net', {
            exact: true,
          }),
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
    } finally {
      await browserPage.viewport(414, 896);
    }
  },
);

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.remote-access',
  route: '/',
  reach:
    'sidebar → Settings → Sharing → Local network, Tailscale, Cloudflare tunnel',
  shortcut: 'Alt+Shift+S',
  behaviour:
    'Settings → Sharing turns the local network, the tailnet and a Cloudflare tunnel on and off, shows each starting and then the addresses it serves, the tailnet at its HTTPS Tailscale name, or why it failed, warns that the local network is not encrypted and names the one network it listens on, and turns the tunnel on once its public hostname is saved.',
  server: ['access.remote-access'],
  spec: 'apps/web/spec/browser/access-remote-access.browser.ts',
} satisfies JourneyEntry;

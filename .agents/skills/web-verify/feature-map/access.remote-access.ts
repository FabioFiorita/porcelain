import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.remote-access',
  route: '/',
  reach:
    'sidebar → Settings → Ways in → Local network, Tailscale, Cloudflare tunnel',
  shortcut: 'Alt+Shift+S',
  shell: 'desktop',
  behaviour:
    'Settings → Ways in turns the local network, the tailnet and a Cloudflare tunnel on and off, shows each starting and then the addresses it serves, the tailnet at the HTTPS Tailscale name the owner saves together with the one tailscale serve command to run, or why it failed, warns that the local network is not encrypted and names the one network it listens on, and turns the tunnel on once its public hostname is saved.',
  server: ['access.remote-access'],
  spec: 'apps/web/spec/browser/access-remote-access.browser.ts',
} satisfies JourneyEntry;

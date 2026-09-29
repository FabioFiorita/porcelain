import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.share',
  route: '/',
  reach: 'sidebar → Settings → Sharing',
  shortcut: 'Alt+Shift+S',
  behaviour:
    'On the computer that runs Porcelain, Settings → Sharing creates a one-time pairing link with its QR code for an address a route serves, lists the paired devices and pending links with this browser marked, and revokes another device.',
  server: ['access.share', 'access.remote-access'],
  spec: 'apps/web/spec/browser/access-share.browser.ts',
} satisfies JourneyEntry;

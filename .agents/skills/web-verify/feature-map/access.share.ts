import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.share',
  route: '/$projectId/$worktreeId/settings',
  reach: 'sidebar → Settings → Sharing',
  shortcut: 'Alt+Shift+S',
  shell: 'desktop',
  behaviour:
    'On the computer that runs Porcelain, Settings → Sharing creates a one-time pairing link with its QR code for the one way in the device will work through, lists the paired devices with the way in each is bound to and the pending links with this browser marked, and revokes another device.',
  server: ['access.share', 'access.remote-access', 'access.device-routes'],
  spec: 'apps/web/spec/browser/access-share.browser.ts',
} satisfies JourneyEntry;

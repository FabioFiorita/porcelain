import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.disconnect',
  route: '/',
  reach: 'sidebar → Settings → Connection → Disconnect this browser',
  shortcut: 'Alt+Shift+S',
  behaviour:
    'Disconnecting this browser from Settings ends its session and shows how to pair it again while the device stays paired, and it is refused while a file draft cannot be saved.',
  server: ['access.session'],
  spec: 'apps/web/spec/browser/access-disconnect.browser.ts',
} satisfies JourneyEntry;

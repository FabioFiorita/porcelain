import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.device-trust',
  route: '/settings/$section',
  reach: 'Toggle Sidebar → Settings → Devices → … can update Porcelain',
  shell: 'desktop',
  behaviour:
    'On Devices the owner lets a paired device update Porcelain and takes it back, and creates a pairing link whose device may update Porcelain.',
  server: ['access.device-trust', 'access.share'],
  spec: 'apps/web/spec/browser/access-device-trust.browser.ts',
} satisfies JourneyEntry;

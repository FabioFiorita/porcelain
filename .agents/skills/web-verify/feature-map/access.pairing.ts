import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.pairing',
  route: '/pair',
  reach: 'open the one-time link that porcelain pair prints',
  behaviour:
    'A one-time link pairs the browser as a device, opens the connected workspace and leaves no code in the address bar.',
  server: ['access.health', 'access.pairing', 'projects.inventory'],
  spec: 'apps/web/spec/browser/access-pairing.browser.ts',
} satisfies JourneyEntry;

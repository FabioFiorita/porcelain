import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.foreign-link',
  route: '/pair',
  reach: 'open a pairing link made for another Porcelain installation',
  behaviour:
    'A pairing link made for another installation is refused after checking the real server health, and no device is paired.',
  server: ['access.health'],
  spec: 'apps/web/spec/browser/access-foreign-link.browser.ts',
} satisfies JourneyEntry;

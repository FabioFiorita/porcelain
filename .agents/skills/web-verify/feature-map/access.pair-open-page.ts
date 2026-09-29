import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'access.pair-open-page',
  route: '/pair',
  reach:
    'the not-paired page already open → enter the one-time link in the same tab',
  behaviour:
    'A one-time link entered in a tab already showing the not-paired page pairs the browser and opens the workspace.',
  server: ['access.pairing', 'projects.inventory'],
  spec: 'apps/web/spec/browser/access-pair-open-page.browser.ts',
} satisfies JourneyEntry;

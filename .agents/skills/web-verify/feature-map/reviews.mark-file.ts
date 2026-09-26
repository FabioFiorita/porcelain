import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.mark-file',
  route: '/',
  reach: 'changed file → Mark as reviewed',
  shortcut: 'R',
  behaviour:
    'Marking and unmarking a changed file as reviewed updates its control and the server keeps each change.',
  server: ['reviews.reviewed-files'],
  spec: 'apps/web/spec/browser/reviews-mark-file.browser.ts',
} satisfies JourneyEntry;

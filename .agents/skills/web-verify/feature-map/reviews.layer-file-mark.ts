import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.layer-file-mark',
  route: '/',
  reach: 'Review → published layer → file → Mark as reviewed',
  behaviour:
    'A file inside a published layer is marked and unmarked reviewed on its own, and the server keeps each change like any changed file.',
  server: ['reviews.reviewed-files'],
  spec: 'apps/web/spec/browser/reviews-layer-file-mark.browser.ts',
} satisfies JourneyEntry;

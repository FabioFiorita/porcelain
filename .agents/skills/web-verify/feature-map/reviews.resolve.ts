import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.resolve',
  route: '/',
  reach: 'Review → Comments → thread → Resolve, then Resolved → Reopen',
  behaviour:
    'Resolving a comment thread moves it from the open comments to the resolved ones and the server keeps it resolved, and reopening it moves it back.',
  server: ['reviews.comment-threads'],
  spec: 'apps/web/spec/browser/reviews-resolve.browser.ts',
} satisfies JourneyEntry;

import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.readiness',
  route: '/',
  reach: 'Review → Readiness',
  behaviour:
    'The readiness panel counts reviewed files, marks that went stale, changes the review does not explain, comments waiting on the agent and failing checks, and opens the proof from its checks line.',
  server: ['reviews.reviewed-files', 'reviews.comment-threads'],
  spec: 'apps/web/spec/browser/reviews-readiness.browser.ts',
} satisfies JourneyEntry;

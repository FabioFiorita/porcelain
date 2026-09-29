import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.delete-resolved',
  route: '/',
  reach: 'Review → Comments → Resolved → Delete resolved → Delete',
  behaviour:
    'After confirming, the reviewer deletes every resolved thread they started, for them and for the agent, while a resolved thread the agent started stays and the confirmation says so.',
  server: ['reviews.delete-resolved-comments', 'reviews.comment-threads'],
  spec: 'apps/web/spec/browser/reviews-delete-resolved.browser.ts',
} satisfies JourneyEntry;

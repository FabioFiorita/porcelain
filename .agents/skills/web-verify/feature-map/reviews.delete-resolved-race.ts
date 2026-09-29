import type { JourneyEntry } from '../scripts/catalogue.ts';

export default {
  feature: 'reviews.delete-resolved-race',
  route: '/',
  reach:
    'Review → Comments → Resolved → Delete resolved, while the agent replies',
  behaviour:
    'A resolved thread the agent answers after the reviewer opened the confirmation is not deleted, and the dialog says it was kept because it changed.',
  server: ['reviews.delete-resolved-comments'],
  spec: 'apps/web/spec/browser/reviews-delete-resolved-race.browser.ts',
} satisfies JourneyEntry;
